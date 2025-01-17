#!/usr/bin/env python3
import ast
import datetime
import json
import logging
import os
import time
import urllib.parse
from dataclasses import dataclass

import click
import pandas as pd
import requests
from dateutil.relativedelta import relativedelta
from pydantic import ValidationError
from sqlalchemy import create_engine, func, or_, select, text, bindparam
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.orm.query import Query

from fleetmanager.api.configuration.schemas import Vehicle
from fleetmanager.api.location.schemas import AllowedStart as AllowedStartSchema
from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    FuelTypes,
    RoundTrips,
    SimulationSettings,
    Trips,
    VehicleTypes,
)
from fleetmanager.data_access.dbschema import RoundTripSegments
from fleetmanager.extractors.util import get_allowed_starts_with_additions
from fleetmanager.model.roundtripaggregator import aggregator, process_car_roundtrips
from fleetmanager.model.roundtripaggregator import aggregating_score as score

logger = logging.getLogger(__name__)


@click.group()
@click.option("-db", "--db-name", envvar="DB_NAME", required=True)
@click.option("-pw", "--password", envvar="DB_PASSWORD", required=True)
@click.option("-u", "--db-user", envvar="DB_USER", required=True)
@click.option("-l", "--db-url", envvar="DB_URL", required=True)
@click.option("-dbs", "--db-server", envvar="DB_SERVER", required=True)
@click.option("-k", "--keys", envvar="KEYS", required=True)
@click.pass_context
def cli(
    ctx,
    db_name=None,
    password=None,
    db_user=None,
    db_url=None,
    db_server=None,
    keys=None,
):
    """
    Preserves the context for the remaining functions
    Parameters
    ----------
    ctx
    """
    ctx.ensure_object(dict)
    engine = create_engine(f"{db_server}://{db_user}:{password}@{db_url}/{db_name}")
    # todo multiple api keys for fleetcomplete is not implemented
    ctx.obj["engine"] = engine
    ctx.obj["Session"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    ctx.obj["url"] = "https://app.ecofleet.com/seeme/"
    ctx.obj["params"] = {"key": keys, "json": ""}


@cli.command()
@click.pass_context
def set_starts(ctx):
    blacklist_id = []  # placeholder for location that you don't want loaded
    id_to_latlon = {}  # placeholder for places that don't have an associated lat/lon

    Session = ctx.obj["Session"]
    engine = ctx.obj["engine"]
    params = ctx.obj["params"]
    url = ctx.obj["url"]

    # pulling AllowedStarts start
    places_response = run_request(url + "Api/Places/get", params=params)
    allowed_starts = []
    current_starts = pd.read_sql(Query(AllowedStarts).statement, engine)
    for place in json.loads(places_response.content)["response"]:
        id_ = place["id"]
        if id_ in blacklist_id or id_ in current_starts.id.values:
            # don't add if the place already exist
            continue
        if "latitude" not in place or place.get("latitude", None) is None:
            lat, lon = get_latlon_address(place["name"])
        else:
            lat = place["latitude"]
            lon = place["longitude"]
        if lat is None and id_ not in id_to_latlon:
            print(f"Failed getting lat/lon for place(id={id_}, name={place['name']})")
            continue
        if lat is None:
            lat, lon = id_to_latlon[place["id"]]
        allowed_starts.append(
            AllowedStarts(
                id=int(place["id"]), address=place["name"], latitude=lat, longitude=lon
            )
        )
    with Session.begin() as sess:
        sess.add_all(allowed_starts)
        sess.commit()


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=False)
@click.option("-el", "--exempt-locations", is_flag=True, default=False)
def set_vehicles(ctx, description_fields=None, exempt_locations=False):
    fuel_to_type = {
        # benzin til fossilbil
        1: 4,
        # diesel til fossilbil
        2: 4,
        # el til elbil
        3: 3,
    }

    default_types = {
    }

    Session = ctx.obj["Session"]
    engine = ctx.obj["engine"]
    params = ctx.obj["params"]
    url = ctx.obj["url"]

    # Cars start
    # getting vehicle settings for setting type ids on the cars
    starts = pd.read_sql(Query(AllowedStarts).statement, engine)
    fuel_settings = pd.read_sql(Query(FuelTypes).statement, engine)
    vehicle_settings = pd.read_sql(Query(VehicleTypes).statement, engine)
    vehicles_response = requests.get(url + "Api/Vehicles/get", params=params)
    cars = json.loads(vehicles_response.content)["response"]
    # get currently saved cars to update if changes and save new ones
    current_cars = pd.read_sql(
        Query(Cars).filter(
            or_(Cars.deleted == False, Cars.deleted.is_(None)),
            or_(Cars.disabled == False, Cars.disabled.is_(None))
        ).statement, engine)

    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    for car in cars:
        id_ = car["id"]

        if (
            pd.isna(car["booking"]["homeLocation"])
            or car["booking"]["homeLocation"] not in starts.id.values
        ) and not exempt_locations:
            print(
                f"Car {id_} did not have any homeLocation or saved location: {car['booking']['homeLocation']}"
            )
            # continue

        plate = car["plate"]
        if plate is not None and len(plate) > 7:
            plate = plate[:7]

        if all(
            [plate is None, car["info"]["make"] is None, car["info"]["model"] is None]
        ):
            continue

        fuel = None
        vehicle_type = None
        if car["info"]["fuelType"]:
            fuel = car["info"]["fuelType"]
            if fuel in fuel_settings.name.values:
                fuel = int(
                    fuel_settings[fuel_settings.name == fuel].refers_to.values[0]
                )
            else:
                fuel = None

        if car["info"]["vehicleType"]:
            # check the refers to
            vehicle_type = car["info"]["vehicleType"]
            if vehicle_type in vehicle_settings.name.values:
                vehicle_type = int(
                    vehicle_settings[
                        vehicle_settings.name == vehicle_type
                    ].refers_to.values[0]
                )
            else:
                vehicle_type = None
        if vehicle_type is None and fuel:
            # best guess
            vehicle_type = fuel_to_type[fuel]

        model = car["info"]["model"]
        if vehicle_type is None and fuel is None and model in default_types.keys():
            fuel = default_types[model]["fuel"]
            vehicle_type = default_types[model]["type"]

        location = (
            None
            if car["booking"]["homeLocation"] is None or exempt_locations
            else int(car["booking"]["homeLocation"])
        )

        department_exists = (
            False if car["groups"] is None or len(car["groups"]) == 0 else True
        )
        department = None
        departments = None if not department_exists else car["groups"]
        if departments:
            response_ = run_request(
                url + "Api/Organization/ObjectGroups/get", params=params
            )
            response = json.loads(response_.content)["response"]
            if response:
                department = map(
                    lambda final_group: final_group["title"]
                    .replace("Gruppe:", "")
                    .strip(),
                    filter(
                        lambda qualified_group: "Gruppe:" in qualified_group["title"],
                        filter(lambda group: group["id"] in departments, response),
                    ),
                )
                try:
                    department = next(department)
                except StopIteration:
                    department = None
                    pass

        car_details = dict(
            id=car["id"],
            plate=plate,
            make=car["info"]["make"],
            model=car["info"]["model"],
            type=None,  # for now, we're avoiding to set type and fuel - because we don't get the wltp on the api
            fuel=None,
            # todo implement "auto fill" if the below metrics doesn't exist and similar make model exist
            wltp_fossil=None,  # todo update when we receive confirmation
            wltp_el=None,  # todo update when we receive confirmation
            co2_pr_km=None,  # todo update when we receive confirmation
            range=None,  # todo update when we receive confirmation
            location=None if location is None else int(location),
            department=department,
            description=" ".join(
                [attr for field in description_fields if (attr := car.get(field))]
            ),
        )

        with Session.begin() as session:
            if id_ in current_cars.id.values:
                if not update_car(
                    car_details, current_cars[current_cars.id == id_].iloc[0]
                ):
                    continue

                current_car = session.query(Cars).filter(Cars.id == id_).first()
                if not current_car:
                    # not possible
                    continue

                validate_dict = compare_new_old(car_details, current_car.__dict__)
                if not is_car_valid(validate_dict):
                    continue

                values_changed = False
                for key, value in car_details.items():
                    if key == "id" or pd.isna(value) or current_car.__dict__.get(key) == value:
                        continue
                    values_changed = True
                    setattr(current_car, key, value)

                if values_changed:
                    session.add(current_car)

            elif is_car_valid(car_details):
                session.add(Cars(**car_details))
    # Cars end


@cli.command()
@click.pass_context
def set_trips(ctx):
    session = ctx.obj["Session"]
    engine = ctx.obj["engine"]
    params = ctx.obj["params"]
    url = ctx.obj["url"]

    all_cars = pd.read_sql(Query(Cars).statement, engine)
    start_locations = pd.read_sql(Query(AllowedStarts).statement, engine)
    address2id = {a.address: a.id for a in start_locations.itertuples()}

    now = datetime.datetime.now()

    for car in all_cars.itertuples():
        car_trips = []
        lat, lon, address_id = None, None, None
        if not pd.isna(car.location) and int(car.location) in start_locations.id.values:
            print(f"Pulling trips for {car.id}", flush=True)
            lat, lon, address_id = start_locations[start_locations.id == car.location][
                ["latitude", "longitude", "id"]
            ].values[0]
        else:
            continue

        start_date = datetime.datetime(year=2022, month=1, day=20)
        with session() as s:
            last_trip_end = (
                s.query(func.max(Trips.end_time))
                .filter(Trips.car_id == car.id)
                .first()[0]
            )
        if last_trip_end is not None:
            start_date = last_trip_end

        month_pairs = quantize_months(start_date, now)
        for k, (start_month, end_month) in enumerate(month_pairs):
            params["objectId"] = car.id
            params["begTimestamp"] = start_month
            params["endTimestamp"] = end_month

            response_ = run_request(url + "Api/Vehicles/getTrips", params=params)
            response = json.loads(response_.content)["response"]
            print(
                f"pulled {0 if response is None else len(response)} for car id {car.id} in period {start_month} to {end_month}"
            )
            if response is None:
                continue
            for trip in response:
                start_location = (
                    None
                    if trip["startLocation"] not in address2id
                    else address2id[trip["startLocation"]]
                )
                car_trips.append(
                    Trips(
                        **dict(
                            id=trip["id"],
                            car_id=car.id,
                            distance=trip["distance"],
                            start_time=datetime.datetime.fromisoformat(
                                trip["startTimestamp"][:-5]
                            ),
                            end_time=datetime.datetime.fromisoformat(
                                trip["endTimestamp"][:-5]
                            ),
                            start_latitude=trip["startLatitude"],
                            start_longitude=trip["startLongitude"],
                            end_latitude=trip["endLatitude"],
                            end_longitude=trip["endLongitude"],
                            start_location=start_location,
                            driver_name=None,
                        )
                    )
                )
        if car_trips:
            with session() as s:
                s.add_all(car_trips)
                s.commit()
            print(f"Saved {len(car_trips)} for {car.id}", flush=True)


@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    session_maker: sessionmaker[Session] = ctx.obj["Session"]
    engine = ctx.obj["engine"]

    with session_maker() as session:
        # getting the starts to find out where we can drive from
        allowed_starts = get_allowed_starts_with_additions(session=session)

        collected_trip_length = 0
        collected_trip_count = 0
        collected_route_length = 0
        collected_route_count = 0
        cars = pd.read_sql(
            Query(Cars).filter(Cars.omkostning_aar.isnot(None)).statement, engine
        )

        banned_cars = (
            session.query(Cars.id)
            .filter(or_(Cars.deleted == True, Cars.disabled == True))
            .all()
        )

        for car in cars.itertuples():
            if car.id in banned_cars or pd.isna(car.location):
                continue
            max_date = session.scalar(
                select(func.max(RoundTrips.end_time).label("max"))
                .select_from(RoundTrips)
                .filter(RoundTrips.car_id == car.id)
            )
            current_trips = get_trips(
                car.id,
                ctx.obj["url"],
                from_date=max_date,
                start_location=car.location,
                params=ctx.obj["params"],
            )
            if len(current_trips) == 0:
                continue
            car_trips = pd.DataFrame(current_trips)
            (
                usage_count,
                possible_count,
                usage_distance,
                possible_distance,
            ) = process_car_roundtrips(
                car,
                car_trips,
                allowed_starts,
                aggregator,
                score,
                session_maker,
                is_session_maker=True,
            )
            collected_route_count += usage_count
            collected_trip_count += possible_count
            collected_route_length += usage_distance
            collected_trip_length += possible_distance

    print("*****************" * 3)
    print(
        f"Collected route count {collected_route_count},    Collected trip count {collected_trip_count}      "
        f"ratio {collected_route_count/max(collected_trip_count, 1)}"
    )
    print(
        f"Collected route length {collected_route_length},    Collected trip length {collected_trip_length}      "
        f"ratio {collected_route_length / max(collected_trip_length, 1)}"
    )


@cli.command()
@click.pass_context
def clean_roundtrips(ctx):
    engine = ctx.obj["engine"]
    Session = ctx.obj["Session"]

    rt = pd.read_sql(
        Query([RoundTrips.id, RoundTrips.start_time, RoundTrips.car_id]).statement,
        engine,
    )
    keep = rt.drop_duplicates(["start_time", "car_id"]).id.values
    remove = [int(a) for a in rt[~rt.id.isin(keep)].id.values]
    if len(remove) != 0:
        assert len(rt) > len(remove), "Did not clean"
        print(f"Removing {len(remove)} duplicates", flush=True)
        with Session() as sess:
            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_(remove)
            ).delete(synchronize_session="fetch")
            sess.query(RoundTrips).filter(RoundTrips.id.in_(remove)).delete(
                synchronize_session="fetch"
            )
            sess.commit()

    with Session() as sess:
        keep_data = (
            sess.query(SimulationSettings)
            .filter(SimulationSettings.name == "keep_data")
            .first()
        )
        if keep_data:
            delete_time = (
                datetime.datetime.now()
                - relativedelta(months=int(keep_data.value))
                - datetime.timedelta(days=1)
            )
            assert delete_time < datetime.datetime.now() - relativedelta(
                months=6
            ), "Not allowing to delete less than 6 months old data"
            rtr = (
                sess.query(RoundTrips.id)
                .filter(RoundTrips.start_time < delete_time)
                .all()
            )
            print(
                f"********************* would like to delete, {len(rtr)} roundtrips",
                flush=True,
            )
            chunk_size = 2000
            for i in range(0, len(rtr), chunk_size):
                current_rtr = rtr[i:i + chunk_size]
                sess.query(RoundTripSegments).filter(
                    RoundTripSegments.round_trip_id.in_([r.id for r in current_rtr])
                ).delete(synchronize_session="fetch")
                sess.commit()

            sess.query(RoundTrips).filter(RoundTrips.start_time < delete_time).delete(
                synchronize_session="fetch"
            )

            sess.commit()


@dataclass
class TripIntermedieary:
    id: int
    car_id: int
    distance: float
    start_time: datetime.datetime
    end_time: datetime.datetime
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    start_location: int | None
    driver_name: str | None


def get_trips(
    car_id: int,
    url: str,
    from_date: datetime.datetime | None = None,
    start_location: int | None = None,
    params=None,
    n_date=None,
) -> list[TripIntermedieary]:
    current_time = n_date
    if n_date is None:
        current_time = datetime.datetime.now()
    min_time = datetime.datetime.fromisoformat(os.getenv("MAX_DATE", "2023-01-01"))
    if from_date is None or from_date < min_time:
        from_date = min_time

    trips = []
    for k, (start_date, end_date) in enumerate(
        quantize_months(from_date, current_time)
    ):
        params["objectId"] = car_id
        params["begTimestamp"] = start_date
        params["endTimestamp"] = end_date

        response_ = run_request(url + "Api/Vehicles/getTrips", params=params)
        response = json.loads(response_.content)["response"]
        print(
            f"pulled {0 if response is None else len(response)} for car id {car_id} in period {start_date} to {end_date}"
        )
        if response is None:
            continue
        for trip in response:
            trips.append(
                TripIntermedieary(
                    id=trip["id"],
                    car_id=car_id,
                    distance=trip["distance"],
                    start_time=datetime.datetime.fromisoformat(
                        trip["startTimestamp"][:-5]
                    ),
                    end_time=datetime.datetime.fromisoformat(trip["endTimestamp"][:-5]),
                    start_latitude=trip["startLatitude"],
                    start_longitude=trip["startLongitude"],
                    end_latitude=trip["endLatitude"],
                    end_longitude=trip["endLongitude"],
                    start_location=start_location,
                    driver_name=None,
                )
            )
    return trips


def quantize_months(start_date, end_date, days=28):
    """
    Getting tuples of dates from start_date to end_date split by days length.

    Parameters
    ----------
    start_date  :   datetime, the date to start the quantisation
    end_date    :   datetime, the date to end the quantisation
    days    :   time between output (start, end)

    Returns
    -------
    list of date tuples
    """
    month_tuples = []
    date_index = start_date
    stop = False
    while True:
        next_month = date_index + datetime.timedelta(days=days)
        if next_month > end_date:
            stop = True
            next_month = end_date
        if (next_month - date_index).days == days or stop:
            month_tuples.append((date_index.isoformat(), next_month.isoformat()))
        date_index = next_month
        if stop:
            break
    return month_tuples


def run_request(uri, params):
    """
    Wrapper to retry request if it fails
    """
    while True:
        response = requests.get(uri, params=params)
        if response.status_code != 429:
            break
        print("Too many requests retrying...")
        time.sleep(3)  # Handle too many requests
    return response


def to_list(env_string):
    if type(env_string) is str:
        return ast.literal_eval(env_string)
    return env_string


def get_latlon_address(address):
    """
    Fallback function if no gps coordination is associated with the address
    """
    osm_url = (
        "https://nominatim.openstreetmap.org/search/"
        + urllib.parse.quote(address)
        + "?format=json"
    )
    response = requests.get(osm_url).json()
    if len(response) == 0:
        return [None, None]
    return [float(response[0]["lat"]), float(response[0]["lon"])]


def update_car(vehicle, saved_car):
    """returns true if saved car values are not equal to the new vehicle input"""
    for key, value in vehicle.items():
        if pd.isna(value) and pd.isna(saved_car[key]):
            continue
        if value != saved_car[key]:
            return True
    return False


def is_car_valid(car_dict):
    validation_dict = car_dict.copy()
    validation_dict["fuel"] = {"id": validation_dict.get("fuel", None)}
    validation_dict["type"] = {"id": validation_dict.get("type", None)}
    validation_dict["location"] = {"id": validation_dict.get("location", None)}
    validation_dict["leasing_type"] = {"id": validation_dict.get("leasing_type", None)}
    try:
        Vehicle(**validation_dict)
    except ValidationError as e:
        logger.warning(
            f"\n\n**************************************\n"
            f"Could not validate vehicle {car_dict['id']}\n"
            f"{e}\n"
            f"{car_dict}\n\n"
            f"Not saving/updating the vehicle\n"
            f"**************************************\n\n"
        )
        return False
    return True


def compare_new_old(car_dict, saved_dict):
    new_comparable = saved_dict.copy()
    for key, value in car_dict.items():
        if key == "id" or pd.isna(value):
            continue
        new_comparable[key] = value
    return new_comparable


def location_precision_test(
    session: Session,
    keys: list[str],
    location: int,
    cars: list,
    test_specific_start: AllowedStartSchema,
    start_date: datetime.date | datetime.datetime,
):
    """
    function to test the precision with added parking spots
    """
    carids = [str(car.id) for car in cars]
    carid2key = {}

    car_url = "https://app.ecofleet.com/seeme/Api/Vehicles/get"
    base_url = "https://app.ecofleet.com/seeme/"

    for k, key in enumerate(keys):
        if len(carid2key) == len(cars):
            break

        params = {"key": key, "json": ""}
        vehicles = run_request(car_url, params)
        if vehicles.status_code != 200:
            logger.info(f"failed retrieving vehicles in key no: {k}")
            continue

        vehicles = vehicles.json().get("response", [])
        found_vehicles = list(filter(lambda car: str(car.get("id", "noId")) in carids, vehicles))
        if len(found_vehicles) == 0:
            continue
        carid2key.update({str(car.get("id")): key for car in found_vehicles})

    allowed_starts = get_allowed_starts_with_additions(session=session, exempt_location=location)

    allowed_starts += [
        {
            "id": location,
            "latitude": addition.latitude,
            "longitude": addition.longitude
        } for addition in test_specific_start.additional_starts
    ]
    allowed_starts += [
        {
            "id": location,
            "latitude": test_specific_start.latitude,
            "longitude": test_specific_start.longitude
        }
    ]

    for car in cars:
        if str(car.id) not in carid2key:
            logger.info(f"Car id {car.id} not found in trackers amongst the keys")
            continue
        params = {"key": carid2key[str(car.id)], "json": ""}

        car_trips = get_trips(
            car.id,
            base_url,
            from_date=start_date,
            params=params
        )

        if len(car_trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        car_trips = pd.DataFrame(
            list(map(lambda trip: trip.__dict__, car_trips))
        )

        precision, total_kilometers = process_car_roundtrips(
            car,
            car_trips,
            allowed_starts,
            aggregator,
            score,
            session,
            is_session_maker=False,
            precision_only=True,
            save=False
        )

        yield {
            "car_id": car.id,
            "precision": precision,
            "kilometers": total_kilometers
        }


if __name__ == "__main__":
    cli()
