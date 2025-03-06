#!/usr/bin/env python3
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, date, time as dttime
from dateutil.relativedelta import relativedelta

import click
import pandas as pd
from sqlalchemy import and_, create_engine, func, or_
from sqlalchemy.orm import Query, sessionmaker, Session

from fleetmanager.api.location.schemas import AllowedStart as AllowedStartSchema

from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    RoundTrips,
    RoundTripSegments,
    FuelTypes,
    VehicleTypes,
    LeasingTypes,
    SimulationSettings
)
from fleetmanager.extractors.mileagebook.updatedb import CarModel
from fleetmanager.extractors.skyhost.updatedb import summer_times, winter_times

from fleetmanager.extractors.util import extract_plate, get_allowed_starts_with_additions
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import aggregating_score as score, sanitise_for_overlaps
from fleetmanager.model.roundtripaggregator import aggregator, process_car_roundtrips

from fleetmanager.extractors.gamfleet.util import run_request, get_splate_info_from_api, get_logs, format_trip_logs

logger = logging.getLogger(__name__)


@dataclass
class GamfleetMappings:
    leasing_type = {
        "Operationel": 1,
        "Finansiel": 2,
        "Ingen": 3,
        "Købt": 3,
        "Ikke sat": None,
        None: None
    }
    fuel = {
        "Benzin": 1,
        "Diesel": 2,
        "El": 3,
        "Cykel": 10,
        "Elcykel": 10,
        "Ikke sat": None,
        None: None
    }
    vehicle_type = {
        "Benzin": 4,
        "Diesel": 4,
        "El": 3,
        "Cykel": 1,
        "Elcykel": 2,
        "Ikke sat": None,
        None: None
    }


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
    ctx.obj["engine"] = engine
    ctx.obj["Session"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    ctx.obj["url"] = "https://gamfleet.azurewebsites.net/External/"
    ctx.obj["params"] = {"ApiKey": key}




@cli.command()
@click.pass_context
def set_starts(ctx):
    # function solely for notifying regarding unsaved district/location names
    url = ctx.obj["url"] + "GetHelsingorVehicles"
    params = ctx.obj["params"]
    params["IsActive"] = 1

    saved_starts = pd.read_sql(Query(AllowedStarts).statement, ctx.obj["engine"]).address.values
    vehicles = run_request(url, params)

    if vehicles.status_code != 200:
        logger.warning(f"Vehicles request for set starts failed with: {vehicles.status_code}")

    vehicles = vehicles.json()
    unique_district_names = set([v.get("DistrictName") for v in vehicles if v.get("DistrictName") not in ["Udfasede", "", None]])

    for unique_dn in unique_district_names:
        if unique_dn not in saved_starts:
            logger.warning(f"New unsaved DistrictName found in GamFleet {unique_dn}")


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=False)
def set_vehicles(ctx, description_fields=None):
    sess = ctx.obj["Session"]()
    url = ctx.obj["url"] + "GetHelsingorVehicles"
    engine = ctx.obj["engine"]
    params = ctx.obj["params"]
    params["IsActive"] = 0

    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    # hent all køretøejr fra gam
    vehicles = run_request(url, params)
    if vehicles.status_code != 200:
        logger.warning(f"Vehicles request for set vehicles failed with: {vehicles.status_code}")
    vehicles = vehicles.json()

    # få de gemte køretøjer
    saved_vehicles = pd.read_sql(Query(Cars).statement, engine)
    saved_columns = saved_vehicles.columns

    # få lokationer til opslag
    GamfleetMappings.locations = {
        location.address: location.id for location in sess.query(AllowedStarts)
    }
    GamfleetMappings.locations[None] = None
    GamfleetMappings.locations[""] = None
    GamfleetMappings.fuel.update({None if key is None else key.lower(): value for key, value in GamfleetMappings.fuel.items()})
    GamfleetMappings.leasing_type.update({None if key is None else key.lower(): value for key, value in GamfleetMappings.leasing_type.items()})
    GamfleetMappings.vehicle_type.update(
        {None if key is None else key.lower(): value for key, value in GamfleetMappings.vehicle_type.items()})

    # iterer over køretøj, tjek om værdier findes
    for vehicle in vehicles:
        vehicle_id = vehicle.get("VehicleId")
        if vehicle_id is None or len(vehicle_id) == 0:
            logger.info("Skipping a vehicle without an ID")
            continue
        vehicle_id = int(vehicle_id)
        saved_vehicle = None
        if vehicle_id in saved_vehicles.id.values:
            saved_vehicle = saved_vehicles[saved_vehicles.id == vehicle_id].iloc[0]

        if saved_vehicle is not None and int(vehicle.get("IsActive")) == 0:
            # disable the vehicle
            db_car = sess.get(Cars, vehicle_id)
            db_car.disabled = 1
            sess.commit()
            logger.info(f"Disabled vehicle {vehicle_id}")
            continue
        elif int(vehicle.get("IsActive")) == 0:
            # skip vehicle all along
            continue

        district_name = vehicle.get("DistrictName")
        if district_name in [None, "", "Udfasede"]:
            # we assume that the vehicle will also be put on IsActive if moved to udfasede
            logger.info(f"Skipping Udfasede/None DistrictName vehicle {vehicle_id}")
            continue

        # only need to collect this again if we have no information on the vehicle
        if (saved_vehicle is None) or (pd.isna(saved_vehicle.wltp_fossil) and pd.isna(saved_vehicle.wltp_fossil) and pd.isna(saved_vehicle.make)):
            plate = extract_plate(vehicle.get("LicensePlate").replace(" ", ""))
            plate = plate if plate else extract_plate(vehicle.get("SecondLicensePlate").replace(" ", ""))
            vehicle_information = {}
            if plate:
                vehicle_information = get_splate_info_from_api(plate)

            # now we should compare and check if update necessary or we should save cause it's new
            drivkraft = vehicle_information.get("drivkraft")
            drivkraft = None if drivkraft is None else drivkraft.lower()
            motor_register_car = {
                "id": vehicle_id,
                "make": vehicle_information.get("make"),
                "model": vehicle_information.get("model"),
                "range": vehicle_information.get("elektrisk_rækkevidde"),
                "wltp_fossil": None if drivkraft == "el" else vehicle_information.get("kml"),
                "wltp_el": vehicle_information.get("el_faktisk_forbrug") if "el_faktisk_forbrug" in vehicle_information else vehicle_information.get("elektrisk_forbrug"),
                "plate": plate,
                "type": GamfleetMappings.vehicle_type[drivkraft],
                "fuel": GamfleetMappings.fuel[drivkraft],
                "location": None if district_name not in GamfleetMappings.locations else GamfleetMappings.locations[district_name],
                "end_leasing": vehicle_information.get("leasing_end"),
                "description": " ".join(
                    [
                        attr
                        for field in description_fields
                        if (attr := vehicle.get(field))
                    ]
                ),
            }

            # determine if it's worth saving, should location flagged?
            if motor_register_car.get("location") is None:
                logger.info(f"New district {district_name} not saved")

            if motor_register_car.get("location") is not None:
                motor_register_car["location_obj"] = sess.get(
                    AllowedStarts, motor_register_car.get("location")
                )
            if motor_register_car.get("fuel") is not None:
                motor_register_car["fuel_obj"] = sess.get(FuelTypes, motor_register_car.get("fuel"))

            if motor_register_car.get("leasing_type") is not None and motor_register_car.get("end_leasing") is not None:
                motor_register_car["leasing_type_obj"] = sess.get(
                    LeasingTypes, motor_register_car.get("leasing_type")
                )
            if motor_register_car.get("type") is not None:
                motor_register_car["type_obj"] = sess.get(VehicleTypes, motor_register_car.get("type"))

            if motor_register_car.get("location") is not None:
                motor_register_car["location_obj"] = sess.get(AllowedStarts, motor_register_car.get("location"))

            if (
                    motor_register_car.get("type") is not None
                    and motor_register_car.get("wltp_fossil") is None
                    and motor_register_car.get("wltp_el") is None
            ):
                # reset the type and fuel if wltp is not set, cars can't be validated without type and wltp entered.
                motor_register_car["type"] = None
                motor_register_car["type_obj"] = None
                motor_register_car["fuel"] = None
                motor_register_car["fuel_obj"] = None


            if saved_vehicle is None:
                # new car, just save it
                sess.add(Cars(**motor_register_car))
                sess.commit()

            else:
                # compare values
                comparable_keys = [
                    key for key in motor_register_car.keys() if key in saved_columns
                ]

                if any(
                        [
                            saved_vehicle.get(key) != motor_register_car.get(key)
                            for key in comparable_keys
                            if pd.isna(motor_register_car.get(key)) is False
                        ]
                ):
                    db_car = sess.get(Cars, vehicle_id)

                    complex_types = {
                        "location": AllowedStarts,
                        "fuel": FuelTypes,
                        "type": VehicleTypes,
                        "leasing_type": LeasingTypes,
                    }
                    for key in comparable_keys:
                        if key == 'leasing_type' and motor_register_car.get("end_leasing") is None:
                            continue
                        new_value = motor_register_car.get(key)
                        if (
                                saved_vehicle.get(key) != new_value
                                and pd.isna(new_value) is False
                                and new_value != 0
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
            # here we only need to check if the location has changed
            saved_location = sess.get(AllowedStarts, saved_vehicle.location)
            if saved_location.address != district_name:
                new_location = sess.query(AllowedStarts).filter(AllowedStarts.address == district_name).first()
                if new_location is None:
                    logger.info(f"New district name does not exist: {district_name}, skipping update on vehicle id {vehicle_id}")
                    continue

                db_car = sess.get(Cars, vehicle_id)
                db_car.location = new_location.id
                db_car.location_obj = new_location
                sess.commit()
                continue


@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    sess = ctx.obj["Session"]()
    url = ctx.obj["url"] + "GetHelsingorVehicleTrips"
    engine = ctx.obj["engine"]
    params = ctx.obj["params"]

    params["IsActive"] = 1
    vehicles = run_request(ctx.obj["url"] + "GetHelsingorVehicles", params)
    if vehicles.status_code != 200:
        logger.warning(f"Vehicles request for set roundtrips failed with: {vehicles.status_code}")
        return
    vehicle_ids = [int(a.get("VehicleId")) for a in vehicles.json()]

    max_date = datetime.fromisoformat(os.getenv("MAX_DATE", "2024-05-01"))

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

    allowed_starts = get_allowed_starts_with_additions(sess)

    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0

    now = datetime.now()

    load_record_path = os.getenv("LOAD_RECORD_PATH", "load_record.json")
    if os.path.exists(load_record_path):
        load_record = json.loads(open(load_record_path).read())
        logger.info(f"Using a load record with {len(load_record)} vehicles")
    else:
        logger.info("Initiating a new load record")
        load_record = {}

    for car_id, car_location, last_date in query_vehicles:
        if int(car_id) not in vehicle_ids:
            continue
        if pd.isna(car_location):
            # no associated location
            continue

        if last_date == max_date and load_record and str(car_id) in load_record:
            last_date = datetime.fromisoformat(load_record.get(str(car_id))) if str(car_id) in load_record else now
            last_date -= relativedelta(
                weeks=2
            )
            # mechanism to avoid loading old data that does not yield roundtrips
        elif last_date != max_date:
            last_date = max(last_date, now - relativedelta(weeks=4))

        logger.info(f"Updating car: {car_id}, last seen: {last_date}")

        car_trips = get_logs(vehicle_id=car_id, from_date=last_date, to_date=now, url=url, params=params)
        if len(car_trips) == 0:
            continue

        car_trips = format_trip_logs(car_trips, car_id)

        if len(car_trips) == 0:
            continue

        # sanitise trips, don't adjust for utc - they're recorded in local time
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

        load_record[str(car_id)] = now.strftime("%Y-%m-%d")

    logger.info("*****************" * 3)
    logger.info(
        f"Collected route count {collected_route_count},    Collected trip count {collected_trip_count}      "
        f"ratio {collected_route_count/max(collected_trip_count, 1)}"
    )
    logger.info(
        f"Collected route length {collected_route_length},    Collected trip length {collected_trip_length}      "
        f"ratio {collected_route_length / max(collected_trip_length, 1)}"
    )

    json.dump(load_record, open(load_record_path, "w"))


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
        logger.warning(f"Removing {len(remove)} duplicates")
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
                datetime.now()
                - relativedelta(months=int(keep_data.value))
                - timedelta(days=1)
            )
            assert delete_time < datetime.now() - relativedelta(
                months=6
            ), "Not allowing to delete less than 6 months old data"

            rtr = (
                sess.query(RoundTrips.id)
                .filter(RoundTrips.start_time < delete_time)
                .all()
            )
            rtrs = (
                sess.query(RoundTripSegments.id)
                .filter(RoundTripSegments.round_trip_id.in_([r.id for r in rtr]))
                .all()
            )
            logger.info(
                f"********************* would like to delete {len(rtrs)} roundtripsegments and {len(rtr)} roundtrips"
            )

            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_([r.id for r in rtr])
            ).delete(synchronize_session="fetch")
            sess.query(RoundTrips).filter(RoundTrips.start_time < delete_time).delete(
                synchronize_session="fetch"
            )
            sess.commit()


def location_precision_test(
        session: Session,
        keys: list[str],
        location: int,
        cars: list,
        test_specific_start: AllowedStartSchema,
        start_date: date | datetime,
):
    """
    function to test precision with new parking spots
    """
    carids = [str(car.id) for car in cars]
    carid2key = {}

    # for now only Helsingoer uses Gamfleet, hence the specifically created endpoint
    cars_url = "https://gamfleet.azurewebsites.net/External/GetHelsingorVehicles"
    trips_url = "https://gamfleet.azurewebsites.net/External/GetHelsingorVehicleTrips"

    for k, key in enumerate(keys):
        if len(cars) == len(carid2key):
            break
        params = {"ApiKey": key, "isActive": 0} # we don't care about active status here
        vehicles = run_request(cars_url, params)
        if vehicles.status_code != 200:
            logger.info(f"failed retrieving vehicles in key no: {k}")
            continue
        vehicles = vehicles.json()
        found_vehicles = list(filter(lambda vehicle: vehicle.get("VehicleId", "noId") in carids, vehicles))
        if len(found_vehicles) == 0:
            continue
        carid2key.update({str(vehicle.get("VehicleId")): key for vehicle in found_vehicles})

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
    now_date = datetime.combine(date.today(), dttime(0))
    for car in cars:
        if str(car.id) not in carid2key:
            logger.info(f"Car id {car.id} not found in trackers amongst the keys")
            continue

        car_trips = get_logs(
            vehicle_id=car.id,
            from_date=start_date,
            to_date=now_date,
            url=trips_url,
            params={"ApiKey": carid2key[str(car.id)]}
        )

        if len(car_trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        car_trips = format_trip_logs(car_trips, car.id)

        if len(car_trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now after formatting")
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


if __name__ == '__main__':
    cli()
