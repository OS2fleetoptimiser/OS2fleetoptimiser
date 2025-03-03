#!/usr/bin/env python3
import json
import os
import pickle
from datetime import datetime, timedelta
import logging

import click
import pandas as pd
from sqlalchemy import create_engine, func, or_, select, update
from sqlalchemy.orm import sessionmaker
from tenacity import RetryError

from fleetmanager.data_access import AllowedStarts, Cars, RoundTrips
from fleetmanager.extractors.clevertrack.api_util import (
    DuplicatePlateCleverTrack,
    TripIdPatchError,
    collect_trips,
    extract_plate,
    find_item_plate_list,
    get_vehicles,
    patch_trips,
)
from fleetmanager.extractors.skyhost.updatedb import (
    sanitise_for_overlaps,
    summer_times,
    winter_times,
)
from fleetmanager.model.roundtripaggregator import aggregating_score as score
from fleetmanager.model.roundtripaggregator import (
    aggregator,
    calc_distance,
    process_car_roundtrips,
)


logger = logging.getLogger(__name__)


class CarObject:
    def __init__(self, id_, plate, max_date):
        self.id = id_
        self.plate = plate
        self.max_date = max_date


@click.group()
@click.option("-db", "--db-name", envvar="DB_NAME", required=True)
@click.option("-pw", "--password", envvar="DB_PASSWORD", required=True)
@click.option("-u", "--db-user", envvar="DB_USER", required=True)
@click.option("-l", "--db-url", envvar="DB_URL", required=True)
@click.option("-dbs", "--db-server", envvar="DB_SERVER", required=True)
@click.option("-t", "--token", envvar="TOKEN", required=True)
@click.pass_context
def cli(
    ctx,
    db_name=None,
    password=None,
    db_user=None,
    db_url=None,
    db_server=None,
    token=None,
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
    ctx.obj["token"] = token


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=True)
def set_vehicles(ctx, description_fields=None):
    # as of 12/12/23 we can only get plate and id from the vehicle endpoint
    session = ctx.obj["Session"]()
    engine = ctx.obj["engine"]

    vehicles = get_vehicles(ctx.obj["token"])
    if vehicles is None:
        return

    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    saved_vehicles = pd.read_sql(select(Cars), con=engine)

    for vehicle in vehicles:
        # try to get plate from first name, then deviceType
        plate = extract_plate(vehicle.get("name"))
        plate = plate if plate else extract_plate(vehicle.get("deviceType"))

        if plate is None:
            continue

        # check for duplicates
        try:
            entry = find_item_plate_list(plate, vehicles)
        except DuplicatePlateCleverTrack as e:
            logger.warning(e)
            continue

        # assume plate is unique in database
        saved_vehicle = saved_vehicles[saved_vehicles.plate == plate]

        # get data from api
        imei = entry.get("imei", "")
        description = " ".join(
            [attr for field in description_fields if (attr := entry.get(field))]
        )
        vid = entry.get("id")

        # plate is not seen before, add to database
        # if plate not in saved_vehicles.plate.tolist():
        if saved_vehicle.empty:
            session.add(Cars(id=vid, plate=plate, imei=imei, description=description))
            # session.commit() ----
            continue

        # plate already exist in data
        saved_vehicle = saved_vehicle.iloc[0]
        if (
            (str(saved_vehicle.id) == vid)
            and (saved_vehicle.plate == plate)
            and (saved_vehicle.imei == imei)
            and (saved_vehicle.description == description)
        ):
            # skip if data is equal
            continue

        # update data
        stmt = (
            update(Cars)
            .where(Cars.id == vid)
            .values(plate=plate, imei=imei, description=description)
        )
        session.execute(stmt)
        session.commit()


@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    max_date = os.getenv("MAX_DATE", "2022-10-14")
    engine = ctx.obj["engine"]
    session = ctx.obj["Session"]()

    trip_id_storage = os.getenv(
        "CAR_TRIPS_IDS",
        "fleetmanager/extractors/clevertrack/car_trip_ids.pkl",
    )
    if not os.path.exists(trip_id_storage):
        patched_ids = {}
    else:
        patched_ids = pickle.load(open(trip_id_storage, "rb"))
    all_visited_ids = [
        id
        for id_bunch in [ids["ids"] for cr in patched_ids.values() for ids in cr]
        for id in id_bunch
    ]

    additional_starts_path = os.getenv(
        "ADDITIONAL_STARTS",
        "samples/default_starts/holbaek_additional_starts.json",
    )
    additional_starts = pd.DataFrame()
    if additional_starts_path:
        additional_starts = pd.DataFrame(json.load(open(additional_starts_path, "r")))
    allowed_starts = pd.read_sql(select(AllowedStarts), con=engine)
    allowed_starts = pd.concat([allowed_starts, additional_starts]).to_dict("records")

    cars_max_time = (
        session.query(
            Cars.id,
            Cars.plate,
            Cars.location,
            func.coalesce(func.max(RoundTrips.end_time), max_date).label("max_date"),
        )
        .filter(
            Cars.omkostning_aar.isnot(None),
            Cars.location.isnot(None),
            or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
            Cars.disabled != 1,
            Cars.deleted != 1,
        )
        .outerjoin(RoundTrips, RoundTrips.car_id == Cars.id)
        .group_by(Cars.id, Cars.plate, Cars.location)
        .all()
    )

    cars = pd.DataFrame(cars_max_time)

    # assume that we won't detect old trip logs more than 20 days old
    overall_min_date = max(cars.max_date.min(), datetime.now() - timedelta(days=20))
    # overall_min_date = datetime.fromisoformat(max_date)
    all_trips = collect_trips(
        token=ctx.obj["token"], start_time=overall_min_date, stop_time=datetime.now()
    )
    logger.info(f"len of all trips before patching {len(all_trips)}")
    # todo get rid of simulation of patched
    all_trips = all_trips[~all_trips.id.isin(all_visited_ids)].copy()
    logger.info(f"len of all trips after patching {len(all_trips)}")

    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0

    for car in cars.itertuples():
        car: CarObject = car
        car_trips = all_trips[
            (all_trips.plate == car.plate) & (all_trips.start_time > car.max_date)
        ]

        if len(car_trips) == 0:
            continue

        car_trips = sanitise_for_overlaps(car_trips, summer_times, winter_times)
        car_trips["distance"] = car_trips.apply(
            lambda trip: (
                trip.distance
                if trip.distance != 0
                else calc_distance(
                    (trip.start_latitude, trip.start_longitude),
                    (trip.end_latitude, trip.end_longitude),
                )
            ),
            axis=1,
        )
        (
            usage_count,
            possible_count,
            usage_distance,
            possible_distance,
            used_ids,
        ) = process_car_roundtrips(
            car,
            car_trips,
            allowed_starts,
            aggregator,
            score,
            session,
            is_session_maker=False,
            return_ids=True,
            save=True,
        )
        collected_route_count += usage_count
        collected_trip_count += possible_count
        collected_route_length += usage_distance
        collected_trip_length += possible_distance

        if usage_count > 0:
            # continue
            patched_ids = write_tripid_file(
                patched_ids, trip_id_storage, used_ids, car.id
            )


@cli.command()
@click.pass_context
def patch_roundtrips(ctx):
    trip_id_storage = os.getenv(
        "CAR_TRIPS_IDS",
        "fleetmanager/extractors/clevertrack/car_trip_ids.pkl",
    )
    if not os.path.exists(trip_id_storage):
        return
    patched_ids_storage = os.getenv(
        "PATCHED_IDS",
        "fleetmanager/extractors/clevertrack/patched.pkl",
    )
    if not os.path.exists(patched_ids_storage):
        patched = []
    else:
        patched = pickle.load(open(patched_ids_storage, "rb"))

    saved_roundtrips = pickle.load(open(trip_id_storage, "rb"))

    for car, roundtrips in saved_roundtrips.items():
        car_trip_ids = [
            int(id_)
            for ids in roundtrips
            for id_ in ids.get("ids", [])
            if int(id_) not in patched
        ]
        if len(car_trip_ids) == 0:
            continue
        try:
            patch_trips(ctx.obj["token"], car_trip_ids)
            patched += car_trip_ids
            write_patch_file(patched, patched_ids_storage)
        except RetryError as e:
            original_exception = e.last_attempt.exception()
            if isinstance(original_exception, TripIdPatchError):
                logger.warning(f"Could not patch the ids from car: {car}\n{e.last_attempt.exception()}\n{car_trip_ids}")
                continue
            else:
                logger.warning(
                    f"Retries failed due to a different exception: {original_exception}"
                )

# todo create clean-roundtrips for clevertrack

def write_tripid_file(patched_ids: dict, path: str, new_ids: list, car_id: int):
    """
    writing the trip id storage to record to which vehicle and what date the ids belong
    """
    if car_id not in patched_ids:
        patched_ids[car_id] = []
    patched_ids[car_id] += new_ids
    pickle.dump(patched_ids, open(path, "wb"))
    return patched_ids


def write_patch_file(patched_ids: list, path: str):
    """
    writing a patch file that records the ids that has been used in a roundtrip and patched
    """
    pickle.dump(patched_ids, open(path, "wb"))
