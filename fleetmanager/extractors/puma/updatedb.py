#!/usr/bin/env python3
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, date, time as dttime
import time

import click
import pandas as pd
from dateutil.relativedelta import relativedelta
from geoalchemy2.shape import to_shape
from sqlalchemy import create_engine, distinct, func, or_, select
from sqlalchemy.orm import Query, sessionmaker, Session

from fleetmanager.api.location.schemas import AllowedStart as AllowedStartSchema
from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    FuelTypes,
    LeasingTypes,
    RoundTrips,
    RoundTripSegments,
    SimulationSettings,
    VehicleTypes,
)
from fleetmanager.extractors.puma.pumaschema import Data, Materiels
from fleetmanager.extractors.skyhost.updatedb import (
    fix_time,
    summer_times,
    winter_times,
)
from fleetmanager.extractors.util import (
    extract_plate,
    get_latlon_address,
    get_plate_info,
    logs_to_trips,
    to_list, get_plate_info_from_api, get_allowed_starts_with_additions,
)
from fleetmanager.model.roundtripaggregator import (
    aggregator,
    car_model,
    sanitise_for_overlaps,
    start_locations,
    process_car_roundtrips
)
from fleetmanager.model.roundtripaggregator import aggregating_score as score

logger = logging.getLogger(__name__)

forvaltninger = to_list(os.getenv("FORVALTNINGER", '["SUF", "BIF", "BUF", "KFF", "ØKF", "SOF", "TMF"]'))
ignore_machine_group = [int(machine_group) for machine_group in os.getenv("IGNORE_MACHINE_GROUP", "").split(",") if machine_group.strip()]

@click.group()
@click.option("-db", "--db-name", envvar="DB_NAME", required=True)
@click.option("-pw", "--password", envvar="DB_PASSWORD", required=True)
@click.option("-u", "--db-user", envvar="DB_USER", required=True)
@click.option("-l", "--db-url", envvar="DB_URL", required=True)
@click.option("-dbs", "--db-server", envvar="DB_SERVER", required=True)
@click.option("-pumadriver", "--pumadriver", envvar="PUMA_DRIVER", required=True)
@click.option("-pumauser", "--pumauser", envvar="PUMA_USER", required=True)
@click.option("-pumaurl", "--pumaurl", envvar="PUMA_URL", required=True)
@click.option("-pumaname", "--pumaname", envvar="PUMA_NAME", required=True)
@click.option("-pumapassword", "--pumapassword", envvar="PUMA_PASSWORD", required=True)
@click.pass_context
def cli(
    ctx,
    db_name=None,
    password=None,
    db_user=None,
    db_url=None,
    db_server=None,
    pumadriver=None,
    pumauser=None,
    pumaurl=None,
    pumaname=None,
    pumapassword=None,
):
    """
    Preserves the context for the remaining functions
    Parameters
    ----------
    ctx
    """
    ctx.ensure_object(dict)
    engine = create_engine(f"{db_server}://{db_user}:{password}@{db_url}/{db_name}")

    puma_engine = create_engine(
        f"{pumadriver}://{pumauser}:{pumapassword}@{pumaurl}/{pumaname}"
    )

    ctx.obj["engine"] = engine
    ctx.obj["Session"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    ctx.obj["puma_engine"] = puma_engine
    ctx.obj["puma_session"] = sessionmaker(
        autocommit=False, autoflush=False, bind=puma_engine
    )


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=True)
def set_vehicles(ctx, description_fields=None):
    puma_session = ctx.obj["puma_session"]()
    session = ctx.obj["Session"]()
    cars_in_db = pd.read_sql(Query(Cars).statement, ctx.obj["engine"])
    known_starts = pd.read_sql(Query(AllowedStarts).statement, ctx.obj["engine"])
    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    fuel = {"benzin": 1, "diesel": 2, "el": 3, "hybrid": 1}

    vehicle_type = {"benzin": 4, "diesel": 4, "el": 3, "hybrid": 4}

    for vehicle in puma_session.query(Materiels).where(
        Materiels.systemstatus.in_(["aktiv", "Ok", "OkMedForbehold", "kass"]),
        Materiels.forvaltning.in_(forvaltninger),
        Materiels.registreringsnummer.isnot(None),
        Materiels.maskingruppe.notin_(ignore_machine_group),
    ):
        if vehicle.placeringsadresse not in known_starts.address.values:
            logger.info(
                f"skipping vehicle: {vehicle.registreringsnummer}, {vehicle.placeringsadresse}"
            )
            continue

        saved_vehicle = cars_in_db[
            (cars_in_db.plate == vehicle.registreringsnummer.replace(" ", "")) | (cars_in_db.id == vehicle.nummer)
        ]
        if len(saved_vehicle) > 1:
            logger.warning(
                f"skipping vehicle, found multiple for {vehicle.registreringsnummer} and {vehicle.nummer}"
            )
            continue
        if len(saved_vehicle) > 0:
            # known vehicle
            saved_vehicle = saved_vehicle.iloc[0]
            id_ = saved_vehicle.id
            if any(
                [
                    pd.isna(getattr(saved_vehicle, key)) is False
                    for key in ["wltp_el", "wltp_fossil"]
                ]
            ):
                new_car_object = saved_vehicle.to_dict()
                location = session.get(
                    AllowedStarts,
                    int(
                        known_starts[
                            known_starts.address == vehicle.placeringsadresse
                        ].id.values[0]
                    ),
                )
                obj_changed = False
                if int(location.id) != int(new_car_object.get("location")):
                    # location changed
                    saved_vehicle_object = session.get(Cars, int(id_))
                    saved_vehicle_object.location = location.id
                    saved_vehicle_object.location_obj = location
                    obj_changed = True
                if saved_vehicle.plate != vehicle.registreringsnummer.replace(" ", ""):
                    logger.info(f"updating plate for {vehicle.nummer}, from {cars_in_db.plate} to {vehicle.registreringsnummer}")
                    obj_changed = True

                if obj_changed:
                    session.commit()
            else:
                continue

        else:
            plate = extract_plate(vehicle.registreringsnummer)
            if not plate:
                continue
            loop = asyncio.get_event_loop()
            logger.info(f"looking for {vehicle.registreringsnummer}")
            try:
                vehicle_attributes = loop.run_until_complete(get_plate_info_from_api(plate))
            except Exception as e:
                logger.info(f"finding plate info from plate failed: {plate}, {e}")
                continue
            if "make" not in vehicle_attributes:
                continue
            drivkraft = vehicle_attributes.get("drivkraft")
            new_car_object = {
                "id": vehicle.nummer,
                "plate": plate,
                "make": vehicle_attributes.get("make"),
                "model": vehicle_attributes.get("model"),
                "wltp_fossil": None
                if drivkraft == "el"
                else vehicle_attributes.get("kml"),
                "wltp_el": vehicle_attributes.get("el_faktisk_forbrug")
                if "el_faktisk_forbrug" in vehicle_attributes
                else vehicle_attributes.get("elektrisk_forbrug"),
                "type": vehicle_type.get(drivkraft),
                "type_obj": None
                if drivkraft is None
                else session.get(VehicleTypes, vehicle_type.get(drivkraft)),
                "fuel": fuel.get(drivkraft),
                "fuel_obj": None
                if drivkraft is None
                else session.get(FuelTypes, fuel.get(drivkraft)),
                "range": vehicle_attributes.get("elektrisk_rækkevidde"),
                "leasing_type": 3,
                "department": vehicle.forvaltning,
                "leasing_type_obj": session.get(LeasingTypes, 3),
                "location": int(
                    known_starts[
                        known_starts.address == vehicle.placeringsadresse
                    ].id.values[0]
                ),
                "location_obj": None
                if vehicle.placeringsadresse is None
                else session.get(
                    AllowedStarts,
                    int(
                        known_starts[
                            known_starts.address == vehicle.placeringsadresse
                        ].id.values[0]
                    ),
                ),
                "description": " ".join(
                    [
                        attr
                        for field in description_fields
                        if (attr := vehicle.get(field))
                    ]
                ),
            }

            session.add(Cars(**new_car_object))
            session.commit()


@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    puma_session = ctx.obj["puma_session"]()
    session = ctx.obj["Session"]()

    allowed_starts: start_locations = get_allowed_starts_with_additions(session)

    banned_cars = list(
        map(
            lambda tup: tup[0],
            session.query(Cars.id)
            .filter(or_(Cars.deleted == True, Cars.disabled == True))
            .all(),
        )
    )
    cars = pd.read_sql(
        select(Cars).where(
            or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
            ~Cars.id.in_(banned_cars),
        ),
        ctx.obj["engine"],
    )

    now = datetime.now()

    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0

    only_natural = json.loads(os.getenv("ONLY_NATURAL", "false"))
    load_record_path = os.getenv("LOAD_RECORD_PATH", "load_record.json")
    if os.path.exists(load_record_path):
        load_record = json.loads(open(load_record_path).read())
        logger.info(f"Using a load record with {len(load_record)} vehicles")
    else:
        logger.info("Initiating a new load record")
        load_record = {}

    for car in cars.itertuples():
        car: Cars = car
        s = time.time()
        logger.info(f"Start vehicle: {car.id}")

        max_date = session.scalar(
            select(func.max(RoundTrips.end_time).label("max"))
            .select_from(RoundTrips)
            .filter(RoundTrips.car_id == car.id)
        )

        if max_date is None and load_record and str(car.id) in load_record:
            max_date = datetime.fromisoformat(load_record.get((str(car.id)))) if car.id in load_record else datetime.now()
            max_date -= relativedelta(
                weeks=2
            )
        elif max_date is not None:
            max_date = max(max_date, now - relativedelta(weeks=4))
        elif max_date is None:
            max_date = datetime.fromisoformat(os.getenv("MAX_DATE", "2023-01-01"))

        # we need to take the plate to find the materielid
        materiel = (
            puma_session.query(Materiels)
            .where(Materiels.registreringsnummer == car.plate)
            .first()
        )
        if not materiel:
            logger.info(f"could not find vehicle: {car.id}, {car.plate}")
            continue

        logs = []
        for start, end in date_iter(max_date, now, week_period=1):
            logger.info(f"{start} - {end}: {len(logs)}")
            query_results = puma_session.query(
                Data.materielid,
                Data.timestamp,
                Data.ignition,
                Data.coords
            ).filter(Data.materielid == materiel.id, Data.timestamp > start, Data.timestamp < end)
            for result in query_results:
                materielid, timestamp, ignition, coords = result
                if coords:
                    shape = to_shape(coords)
                    latitude, longitude = shape.y, shape.x
                else:
                    latitude, longitude = None, None

                logs.append({
                    "id": materielid,
                    "timestamp": timestamp,
                    "ignition": ignition,
                    "latitude": latitude,
                    "longitude": longitude,
                })

        if len(logs) == 0:
            load_record[str(car.id)] = now.strftime("%Y-%m-%d")
            continue

        a_to_b_trips = logs_to_trips(pd.DataFrame(logs))

        if len(a_to_b_trips) == 0:
            load_record[str(car.id)] = now.strftime("%Y-%m-%d")
            continue

        trips = sanitise_for_overlaps(a_to_b_trips, summer_times, winter_times)

        if len(trips) <= 1:
            load_record[str(car.id)] = now.strftime("%Y-%m-%d")
            continue

        trips["start_time"] = trips.start_time.apply(fix_time)
        trips["end_time"] = trips.end_time.apply(fix_time)


        (
            usage_count,
            possible_count,
            usage_distance,
            possible_distance
        ) = process_car_roundtrips(
            car,
            trips,
            allowed_starts,
            aggregator,
            score,
            session,
            is_session_maker=False
        )

        collected_route_length += usage_distance
        collected_trip_length += possible_distance
        collected_trip_count += possible_count
        collected_route_count += usage_count

        load_record[str(car.id)] = now.strftime("%Y-%m-%d")

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
def set_starts(ctx):
    puma_session = ctx.obj["puma_session"]()
    session = ctx.obj["Session"]()

    saved_starts = pd.read_sql(Query(AllowedStarts).statement, ctx.obj["engine"])
    known_addresses = saved_starts.address.unique().astype(str)

    for q in puma_session.query(
        distinct(Materiels.placeringsadresse).label("placeringsadresse")
    ).where(Materiels.forvaltning.in_(forvaltninger)):
        if type(q.placeringsadresse) is not str or len(q.placeringsadresse) <= 3:
            continue
        if q.placeringsadresse in known_addresses:
            continue

        lat, lon = get_latlon_address(q.placeringsadresse + ", København")
        if None in [lat, lon]:
            continue

        logger.info(f"{q.placeringsadresse}: ({lat}, {lon})")

        session.add(
            AllowedStarts(
                id=None,
                address=q.placeringsadresse,
                latitude=lat,
                longitude=lon,
            )
        )
        session.commit()


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
        logger.info(f"Removing {len(remove)} duplicates")
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
                f"********************* would like to delete, {len(rtrs)} roundtripsegments and {len(rtr)} roundtrips"
            )

            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_([r.id for r in rtr])
            ).delete(synchronize_session="fetch")

            sess.query(RoundTrips).filter(RoundTrips.start_time < delete_time).delete(
                synchronize_session="fetch"
            )
            sess.commit()


def date_iter(start_date, end_date, week_period=24):
    """
    Function for iterating over a date period

    Parameters
    ----------
    start_date
    end_date
    week_period :   the period between the returned start and end date

    Returns
    -------
    start_date, end_date with week_period in between
    """
    delta = timedelta(weeks=week_period)
    last_start = start_date
    stopped = False
    while stopped is False:
        start_date += delta
        if start_date > end_date:
            start_date = end_date
            stopped = True
        yield last_start, start_date
        last_start = start_date


def location_precision_test(
    session: Session,
    keys: list[str],  # we don't use the keys with puma extraction
    location: int,
    cars: list,
    test_specific_start: AllowedStartSchema,
    start_date: date | datetime,
):
    """
    function to test the precision with added parking spots
    """
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

    puma_engine = create_engine(
        f"{os.getenv('PUMA_DRIVER')}://{os.getenv('PUMA_USER')}:{os.getenv('PUMA_PASSWORD')}@{os.getenv('PUMA_URL')}/{os.getenv('PUMA_NAME')}"
    )
    puma_session = sessionmaker(bind=puma_engine)()
    now_date = datetime.combine(date.today(), dttime(0))

    for car in cars:
        materiel = (
            puma_session.query(Materiels)
            .where(Materiels.registreringsnummer == car.plate)
            .first()
        )
        if not materiel:
            logger.info(f"could not find vehicle {car.id}, {car.plate} in puma")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        logs = []
        for start, end in date_iter(start_date, now_date, week_period=1):
            logger.info(f"{start}, {end}, {len(logs)}")
            query_results = puma_session.query(
                Data.materielid,
                Data.timestamp,
                Data.ignition,
                Data.coords
            ).filter(Data.materielid == materiel.id, Data.timestamp > start, Data.timestamp < end)
            for result in query_results:
                materielid, timestamp, ignition, coords = result
                if coords:
                    shape = to_shape(coords)
                    latitude, longitude = shape.y, shape.x
                else:
                    latitude, longitude = None, None

                logs.append({
                    "id": materielid,
                    "timestamp": timestamp,
                    "ignition": ignition,
                    "latitude": latitude,
                    "longitude": longitude,
                })
        if len(logs) == 0:
            logger.info(f"could not find trips for vehicle {car.id}, {car.plate} in puma")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        a_to_b_trips = logs_to_trips(pd.DataFrame(logs))
        if len(a_to_b_trips) == 0:
            logger.info(f"could not find trips for vehicle {car.id}, {car.plate} in puma after formatting")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        car_trips = sanitise_for_overlaps(a_to_b_trips, summer_times, winter_times)
        car_trips["start_time"] = car_trips.start_time.apply(fix_time)
        car_trips["end_time"] = car_trips.end_time.apply(fix_time)

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
