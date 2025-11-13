#!/usr/bin/env python3
import os
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from dateutil.relativedelta import relativedelta
from time import sleep
from urllib.parse import parse_qs, urlparse

import click
import pandas as pd
import regex as re
import requests
from sqlalchemy import and_, create_engine, func, or_
from sqlalchemy.orm import Query, Session, sessionmaker

from fleetmanager.api.location.schemas import AllowedStart as AllowedStartSchema
from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    FuelTypes,
    LeasingTypes,
    RoundTrips,
    VehicleTypes,
    SimulationSettings,
    RoundTripSegments,
)
from fleetmanager.extractors.skyhost.updatedb import (
    sanitise_for_overlaps,
    summer_times,
    winter_times,
)
from fleetmanager.extractors.util import get_latlon_address, get_allowed_starts_with_additions
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import aggregating_score as score
from fleetmanager.model.roundtripaggregator import (
    aggregator,
    process_car_roundtrips,
    route,
)


logger = logging.getLogger(__name__)

allowed_statuses = ["Oprettet", "Aktiv - I brug", "Bestilt"]
disallowed_vehicle_categories = ["Traktor", "Motorredskab", "Påhængsredskab", "Påhængsvogn", "Traktor påhængsvogn"]

@dataclass
class MileageBookMappings:
    leasing_type = {
        "Operationel": 1,
        "Finansiel": 2,
        "Ingen": 3,
        "Købt": 3,
        "Ikke sat": None,
    }
    fuel = {
        "Benzin": 1,
        "Diesel": 2,
        "El": 3,
        "Hybrid(El+Benzin)": 1,
        "Cykel": 10,
        "Elcykel": 10,
        "Ikke sat": None,
    }
    vehicle_type = {
        "Benzin": 4,
        "Diesel": 4,
        "Hybrid(El+Benzin)": 4,
        "El": 3,
        "Cykel": 1,
        "Elcykel": 2,
        "Ikke sat": None,
    }


@dataclass
class CarModel:
    id: str
    location: int


@click.group()
@click.option("-db", "--db-name", envvar="DB_NAME", required=True)
@click.option("-pw", "--password", envvar="DB_PASSWORD", required=True)
@click.option("-u", "--db-user", envvar="DB_USER", required=True)
@click.option("-l", "--db-url", envvar="DB_URL", required=True)
@click.option("-dbs", "--db-server", envvar="DB_SERVER", required=True)
@click.option("-k", "--key", envvar="KEY", required=True)
@click.pass_context
def cli(
    ctx,
    db_name=None,
    password=None,
    db_user=None,
    db_url=None,
    db_server=None,
    key=None,
):
    """
    Preserves the context for the remaining functions
    Parameters
    ----------
    ctx
    """
    ctx.ensure_object(dict)
    engine = create_engine(f"{db_server}://{db_user}:{password}@{db_url}/{db_name}")
    # todo multiple api keys for mileagebook is not implemented
    ctx.obj["engine"] = engine
    ctx.obj["Session"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    ctx.obj["url"] = "https://enterpriseapi.mileagebook.com/api"
    ctx.obj["headers"] = {"X-Access-Token": key}


@cli.command()
@click.pass_context
def set_starts(ctx):
    headers = ctx.obj["headers"]
    url = ctx.obj["url"] + "/Fleet/Cars"
    params = {"LastModifiedDateTime": datetime(2020, 1, 1).isoformat()}
    saved_starts = pd.read_sql(Query(AllowedStarts).statement, ctx.obj["engine"])
    sess = ctx.obj["Session"]()
    vehicles = run_request(url, params, headers)

    if vehicles.status_code != 200:
        logger.warning(f"Vehicles request returned {vehicles.status_code}")
        return

    vehicles = vehicles.json().get("Cars", [])
    vehicles = filter(
        lambda vehicle: vehicle.get("Status") in allowed_statuses, vehicles
    )
    unique_addresses = set(
        list(
            map(
                lambda vehicle: vehicle.get("Department", {}).get("Address", ""),
                vehicles,
            )
        )
    )
    unseen_addresses = [
        address
        for address in unique_addresses
        if address != "" and address not in saved_starts.address.values
    ]

    for address in unseen_addresses:
        latitude, longitude = get_latlon_address(address)
        if latitude is None or longitude is None:
            logger.info(f"Skipping location, could not find lat/lon: {address}")
            continue
        new_location = AllowedStarts(
            id=None, address=address, latitude=latitude, longitude=longitude
        )
        sess.add(new_location)
        sess.commit()
        logger.info(f"Added location: {new_location.address}")
        sleep(2)


def _create_description(vehicle: dict, fields: list[str]) -> str:
    parts = []

    for field in fields:
        if field in vehicle:
            parts.append(vehicle.get(field))
            continue

        if field.startswith("CustomFields:"):
            custom_fields = vehicle.get("CustomFields", [])
            if len(custom_fields) == 0:
                continue

            # get name of custom field
            _, name = field.split(":")
            name_func = lambda item: item.get("Name", "") == name

            # filter items with name
            items = list(filter(name_func, custom_fields))
            if len(items) == 0:
                continue

            # only select first item with that name. Take first if there are multiple.
            parts.append(items[0].get("Value", ""))

    return " ".join(parts)


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=True)
def set_vehicles(ctx, description_fields=None):
    sess = ctx.obj["Session"]()
    engine = ctx.obj["engine"]
    headers = ctx.obj["headers"]

    url = ctx.obj["url"] + "/Fleet/Cars"
    params = {"LastModifiedDateTime": datetime(2020, 1, 1).isoformat()}

    vehicles = []
    while True:
        vehicles_response = run_request(url, params, headers)
        if vehicles_response.status_code != 200:
            logger.warning(f"Vehicles request returned {vehicles_response.status_code}")
            break
        vehicles.extend(vehicles_response.json().get("Cars", []))
        if url := vehicles_response.json().get("Pagination", {}).get("Next"):
            continue
        break

    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    saved_vehicles = pd.read_sql(Query(Cars).statement, engine)
    saved_columns = saved_vehicles.columns

    MileageBookMappings.locations = {
        location.address: location.id for location in sess.query(AllowedStarts)
    }
    MileageBookMappings.locations[None] = None
    MileageBookMappings.locations[""] = None

    for vehicle in vehicles:
        change_status_disabled = False
        car_id = vehicle.get("InternalVehicleID")

        if vehicle.get("Status") not in allowed_statuses:
            if car_id in saved_vehicles.id.values:
                # it's a known vehicle that is no longer in active status
                change_status_disabled = True
        if vehicle.get("VehicleCategory") in disallowed_vehicle_categories:
            continue
        current_car = {
            "id": car_id,
            "leasing_type": (
                None
                if vehicle.get("LeasingType") == "None"
                else MileageBookMappings.leasing_type[vehicle.get("LeasingType")]
            ),
            "km_aar": calc_km_aar(vehicle),
            "start_leasing": (
                vehicle.get("StartDate")
                if vehicle.get("StartDate") != "0001-01-01T00:00:00"
                else None
            ),
            "end_leasing": (
                vehicle.get("EndDate")
                if vehicle.get("EndDate") != "0001-01-01T00:00:00"
                else None
            ),
            "omkostning_aar": int(vehicle.get("FixedLeasePayment")) * 12,
            "plate": extract_plate(vehicle.get("LicensePlate")),
            "make": vehicle.get("VehicleBrand"),
            "model": " ".join(
                [vehicle.get("VehicleModel"), vehicle.get("VehicleType")]
            ),
            "fuel": MileageBookMappings.fuel[vehicle.get("FuelType")],
            "type": MileageBookMappings.vehicle_type[vehicle.get("FuelType")],
            "department": vehicle.get("Department", {}).get("Name"),
            "location": MileageBookMappings.locations.get(
                vehicle.get("Department", {}).get("Address")
            ),
            "description": _create_description(vehicle, description_fields),
        }

        if current_car.get("location") is not None:
            current_car["location_obj"] = sess.get(
                AllowedStarts, current_car.get("location")
            )
        if current_car.get("make") is None or current_car.get("make") == "":
            current_car["make"] = vehicle.get("Name")
        if (
            # current_car.get("fuel") == "Ikke sat" and
            "cykel"
            in current_car.get("make", "").lower()
        ):
            current_car["fuel"] = 10
        if (
            current_car.get("fuel") not in ["Ikke sat", None, "bike"]
            and round(vehicle.get("FuelConsumption")) != 0
        ):
            if current_car.get("fuel") == 3:
                current_car["wltp_el"] = vehicle.get("FuelConsumption")
            else:
                current_car["wltp_fossil"] = vehicle.get("FuelConsumption")
        if current_car.get("fuel") == "Ikke sat":
            current_car["fuel"] = None
        if current_car.get("fuel") is not None:
            current_car["fuel_obj"] = sess.get(FuelTypes, current_car.get("fuel"))
        if (
            current_car.get("leasing_type") is not None
            and current_car.get("end_leasing") is not None
        ):
            current_car["leasing_type_obj"] = sess.get(
                LeasingTypes, current_car.get("leasing_type")
            )
        if current_car.get("type") is not None:
            current_car["type_obj"] = sess.get(VehicleTypes, current_car.get("type"))
        if current_car.get("end_leasing") is not None:
            current_car["end_leasing"] = datetime.fromisoformat(
                current_car.get("end_leasing")
            )
        if current_car.get("start_leasing") is not None:
            current_car["start_leasing"] = datetime.fromisoformat(
                current_car.get("start_leasing")
            )

        if (
            current_car.get("type") is not None
            and current_car.get("wltp_fossil") is None
            and current_car.get("wltp_el") is None
        ):
            # reset the type and fuel if wltp is not set, cars can't be validated without type and wltp entered.
            current_car["type"] = None
            current_car["type_obj"] = None
            current_car["fuel"] = None
            current_car["fuel_obj"] = None

        if change_status_disabled:
            current_car["disabled"] = 1
        else:
            current_car["disabled"] = 0

        if car_id in saved_vehicles.id.values:
            # logic for updating values for known vehicles
            saved_vehicle = (
                saved_vehicles[saved_vehicles.id == car_id].iloc[0].to_dict()
            )
            comparable_keys = [
                key for key in current_car.keys() if key in saved_columns
            ] + ["disabled"]

            if any(
                [
                    saved_vehicle.get(key) != current_car.get(key)
                    for key in comparable_keys
                    if pd.isna(current_car.get(key)) is False
                ]
            ):
                db_car = sess.get(Cars, car_id)
                complex_types = {
                    "location": AllowedStarts,
                    "fuel": FuelTypes,
                    "type": VehicleTypes,
                    "leasing_type": LeasingTypes,
                }
                for key in comparable_keys:
                    if key == "leasing_type" and current_car.get("end_leasing") is None:
                        continue
                    new_value = current_car.get(key)
                    if (
                        saved_vehicle.get(key) != new_value
                        and pd.isna(new_value) is False
                        and (new_value != 0 or key == "disabled")
                    ):
                        # something changed
                        setattr(db_car, key, new_value)
                        if key in complex_types:
                            setattr(
                                db_car,
                                f"{key}_obj",
                                sess.get(complex_types[key], new_value),
                            )
                sess.commit()
        else:
            sess.add(Cars(**current_car))
            sess.commit()


@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    headers = ctx.obj["headers"]
    url = ctx.obj["url"] + "/CompanyCarTrips"

    sess = ctx.obj["Session"]()

    # get max date for vehicles that's neither deleted nor disabled
    max_date = datetime.fromisoformat(os.getenv("MAX_DATE", "2023-01-01"))
    query_vehicles = (
        sess.query(
            Cars.id,
            Cars.location,
            func.coalesce(func.max(RoundTrips.end_time), max_date),
        )
        .filter(
            and_(
                or_(Cars.deleted == False, Cars.deleted == 0, Cars.deleted == None),
                or_(Cars.disabled == False, Cars.disabled == 0, Cars.disabled == None),
            ),
            Cars.omkostning_aar.isnot(None),
            or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
        )
        .group_by(Cars.id, Cars.location)
        .outerjoin(RoundTrips, RoundTrips.car_id == Cars.id)
    )

    allowed_starts = get_allowed_starts_with_additions(session=sess)

    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0

    for car_id, car_location, last_date in query_vehicles:
        if pd.isna(car_location):
            # no associated location
            continue
        logger.info(f"{car_id}, {last_date}")
        trips_since_last_roundtrip = get_logs(car_id, last_date, url, headers)
        car_trips = format_trip_logs(
            trips_since_last_roundtrip, start_location_id=car_location
        )
        if len(car_trips) == 0:
            continue

        car_trips = sanitise_for_overlaps(car_trips, summer_times, winter_times)

        (
            usage_count,
            possible_count,
            usage_distance,
            possible_distance,
        ) = process_car_roundtrips(
            CarModel(car_id, car_location),
            car_trips,
            allowed_starts,
            aggregator,
            score,
            sess,
            is_session_maker=False,
            save=True,
        )
        collected_route_count += usage_count
        collected_trip_count += possible_count
        collected_route_length += usage_distance
        collected_trip_length += possible_distance
    logger.info("*****************" * 3)
    logger.info(
        f"Collected route count {collected_route_count},    Collected trip count {collected_trip_count}      "
        f"ratio {collected_route_count/max(collected_trip_count, 1)}"
    )
    logger.info(
        f"Collected route length {collected_route_length},    Collected trip length {collected_trip_length}      "
        f"ratio {collected_route_length / max(collected_trip_length, 1)}"
    )


@cli.command()
@click.pass_context
def clean_roundtrips(ctx):
    engine = ctx.obj["engine"]
    session = ctx.obj["Session"]

    rt = pd.read_sql(
        Query([RoundTrips.id, RoundTrips.start_time, RoundTrips.car_id]).statement,
        engine,
    )
    keep = rt.drop_duplicates(["start_time", "car_id"]).id.values
    remove = [int(a) for a in rt[~rt.id.isin(keep)].id.values]
    if len(remove) != 0:
        assert len(rt) > len(remove), "Did not clean"
        logger.info(f"Removing {len(remove)} duplicates")
        with session.begin() as sess:
            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_(remove)
            ).delete(synchronize_session=False)
            sess.query(RoundTrips).filter(RoundTrips.id.in_(remove)).delete(
                synchronize_session=False
            )
            sess.commit()

    with session.begin() as sess:
        keep_data = (
            sess.query(SimulationSettings)
            .filter(SimulationSettings.name == "keep_data")
            .first()
        )
        if keep_data:
            delete_time = (
                datetime.now()
                - relativedelta(months=int(keep_data.value))
                - timedelta(days=1)
            )
            assert delete_time < datetime.now() - relativedelta(
                months=6
            ), "Not allowing to delete less than 6 months old data"
            rtr = (
                sess.query(RoundTrips.id).filter(RoundTrips.start_time < delete_time).all()
            )
            rtrs = (
                sess.query(RoundTripSegments.id)
                .filter(RoundTripSegments.round_trip_id.in_([r.id for r in rtr]))
                .all()
            )
            logger.info(
                f"********************* would like to delete, {len(rtrs)} roundtripsegments and {len(rtr)} roundtrips"
            )

            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_([r.id for r in rtr])
            ).delete(synchronize_session="fetch")

            sess.query(RoundTrips).filter(RoundTrips.start_time < delete_time).delete(
                synchronize_session="fetch"
            )
            sess.commit()


def get_logs(car_id: int, last_date: datetime, url: str, headers: dict):
    trips = []
    params = {
        "CarID": car_id,
        "FromDateTime": last_date,
        "Properties": ["Time", "Coordinates", "Distance"],
    }
    while True:
        response = run_request(uri=url, params=params, headers=headers)
        if response.status_code != 200:
            logger.warning(f"Trip request returned code {response.status_code}")
            trips = []
            break
        trips += response.json().get("Trips", [])
        pagination = response.json().get("Pagination")
        if pagination is None:
            break
        if pagination.get("CurrentPage", 0) >= pagination.get("TotalPages", 0):
            break

        parsed_url = urlparse(pagination.get("Next", ""))
        parsed_params = parse_qs(parsed_url.query)
        params = parsed_params

    return trips


def format_trip_logs(trips: list[dict], start_location_id: int = 0) -> list[route]:
    parsed_trips = []
    for trip in trips:
        end_time = time.fromisoformat(trip["StopTime"])
        start_time = time.fromisoformat(trip["StartTime"])
        start_date = date.fromisoformat(trip["Date"])
        end_date = (
            start_date if start_time < end_time else start_date + timedelta(days=1)
        )
        if end_date != start_date:
            if datetime.combine(end_date, end_time) - datetime.combine(
                start_date, start_time
            ) > datetime.combine(
                date(2000, 1, 1), time.fromisoformat(trip["TotalTime"])
            ) - datetime.combine(
                date(2000, 1, 1), time(0, 0, 0)
            ):
                # if the total time used does not correlate with the changed timedelta we assume that the date
                # should not have been changed
                end_date = start_date
            # trips that run over midnight

        try:
            parsed_trips.append(
                route(
                    **{
                        "id": trip["ID"],
                        "start_time": datetime.combine(start_date, start_time),
                        "end_time": datetime.combine(end_date, end_time),
                        "start_latitude": float(trip["AddressStartLatitude"]),
                        "start_longitude": float(trip["AddressStartLongitude"]),
                        "end_latitude": float(trip["AddressStopLatitude"]),
                        "end_longitude": float(trip["AddressStopLongitude"]),
                        "distance": float(trip["DistanceTotal"]),
                        "car_id": trip["CarID"],
                        "start_location_id": start_location_id,
                    }
                )
            )
        except ValueError as ve:
            logger.warning(f"Had value error on parsing {ve}\nskipping record {trip['ID']}")

    return parsed_trips


def extract_plate(vehicle_string: str | None):
    plate_pattern = r"[A-Z]{2}\d{5}"
    match = re.search(plate_pattern, vehicle_string)
    if match:
        match = vehicle_string[match.span()[0] : match.span()[1]]
        if "SM0" in match:  # unregistered machines will match on SM0\d{2}
            return
        return match
    return


def calc_km_aar(vehicle):
    if any(
        [
            pd.isna(vehicle.get(key))
            for key in ["BoughtDistance", "StartDate", "EndDate"]
        ]
        + [str(vehicle.get("BoughtDistance")) == str(0)]
    ):
        return None
    start = datetime.fromisoformat(vehicle.get("StartDate"))
    end = datetime.fromisoformat(vehicle.get("EndDate"))
    delta_days = (end - start).days
    if delta_days == 0:
        return None
    return round(vehicle.get("BoughtDistance") / (delta_days / 365))


def run_request(uri, params, headers):
    """
    Wrapper to retry request if it fails
    """
    while True:
        response = requests.get(uri, params=params, headers=headers)
        if response.status_code != 429:
            break
        logger.info("Too many requests retrying...")
        sleep(3)  # Handle too many requests
    return response


def location_precision_test(
    session: Session,
    keys: list[str],
    location: int,
    cars: list,
    test_specific_start: AllowedStartSchema,
    start_date: date | datetime,
):
    """
    function to test the precision with added parking spots
    """
    carids = [str(car.id) for car in cars]
    carid2key = {}

    car_url = "https://enterpriseapi.mileagebook.com/api/Fleet/Cars"
    trips_url = "https://enterpriseapi.mileagebook.com/api/CompanyCarTrips"
    params = {"LastModifiedDateTime": datetime(2020, 1, 1).isoformat()}

    for k, key in enumerate(keys):
        if len(carid2key) == len(cars):
            break
        headers = {"X-Access-Token": key}
        vehicles = run_request(car_url, params, headers)
        if vehicles.status_code != 200:
            logger.info(f"failed retrieving vehicle in key no: {k}")
            continue

        vehicles = vehicles.json().get("Cars", [])
        found_vehicles = list(filter(lambda car: str(car.get("InternalVehicleID", "noID")) in carids, vehicles))
        if len(found_vehicles) == 0:
            continue
        carid2key.update({str(car.get("InternalVehicleID", "noID")): key for car in found_vehicles})

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
        headers = {"X-Access-Token": carid2key[str(car.id)]}
        trips_since_last_roundtrip = get_logs(car.id, start_date, trips_url, headers)
        car_trips = format_trip_logs(
            trips_since_last_roundtrip, start_location_id=location
        )
        if len(car_trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        car_trips = sanitise_for_overlaps(car_trips, summer_times, winter_times)

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
 