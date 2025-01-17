#!/usr/bin/env python3
import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from time import sleep
from typing import TypedDict


import click
import numpy as np
import pandas as pd
import pytz
from dateutil.relativedelta import relativedelta
from sqlalchemy import create_engine, func, or_, text, and_
from sqlalchemy.orm import Session, sessionmaker, selectinload
from sqlalchemy.orm.query import Query

from fleetmanager.extractors.skyhost.util import *
from fleetmanager.api.location.schemas import AllowedStart as AllowedStartSchema
from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    RoundTrips,
    SimulationSettings,
    Trips
)
from fleetmanager.data_access.dbschema import RoundTripSegments
from fleetmanager.extractors.fleetcomplete.updatedb import is_car_valid
from fleetmanager.extractors.gamfleet.util import get_splate_info_from_api
from fleetmanager.extractors.util import get_allowed_starts_with_additions
from fleetmanager.model.roundtripaggregator import (
    aggregator,
    sanitise_for_overlaps,
    process_car_roundtrips,
)
from fleetmanager.model.roundtripaggregator import aggregating_score as score

from fleetmanager.extractors.skyhost.parsers import DrivingBook, MileageLogPositions, Trackers
from fleetmanager.extractors.skyhost.soap_agent import SoapAgent

logger = logging.getLogger(__name__)


@click.group()
@click.option("-db", "--db-name", envvar="DB_NAME", required=True)
@click.option("-pw", "--password", envvar="DB_PASSWORD", required=True)
@click.option("-u", "--db-user", envvar="DB_USER", required=True)
@click.option("-l", "--db-url", envvar="DB_URL", required=True)
@click.option("-dbs", "--db-server", envvar="DB_SERVER", required=True)
@click.option("-k", "--keys", envvar="KEYS", required=True)
@click.option("-acid", "--account-ids", envvar="ACCOUNT_IDS", required=False)
@click.option("-akeys", "--api-keys", envvar="API_KEYS", required=False)
@click.pass_context
def cli(
    ctx,
    db_name=None,
    password=None,
    db_user=None,
    db_url=None,
    db_server=None,
    keys=None,
    account_ids=None,
    api_keys=None,
):
    """
    Preserves the context for the remaining functions
    Parameters
    ----------
    ctx
    """
    if account_ids or api_keys:
        account_ids = account_ids.split(",")
        api_keys = api_keys.split(",")

        if len(account_ids) != len(api_keys):
            raise ValueError("Account ids and api keys must have the same split length")

    ctx.ensure_object(dict)
    engine = create_engine(f"{db_server}://{db_user}:{password}@{db_url}/{db_name}")

    ctx.obj["engine"] = engine
    ctx.obj["Session"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    ctx.obj["SOAP_KEY"] = to_list(keys)
    ctx.obj["api_keys"] = api_keys
    ctx.obj["account_ids"] = account_ids


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
                datetime.now()
                - relativedelta(months=int(keep_data.value))
                - timedelta(days=1)
            )
            assert delete_time < datetime.now() - relativedelta(
                months=6
            ), "Not allowing to delete less than 6 months old data"
            print(delete_time)

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
            print(
                f"********************* would like to delete {len(rtrs)} roundtripsegments and {len(rtr)} roundtrips",
                flush=True,
            )

            sess.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_([r.id for r in rtr])
            ).delete(synchronize_session="fetch")
            sess.query(RoundTrips).filter(RoundTrips.start_time < delete_time).delete(
                synchronize_session="fetch"
            )
            sess.commit()


@cli.command()
@click.pass_context
def set_allowed_starts(ctx):
    """
    Function to update and save locations from the api
    """
    session = ctx.obj["Session"]()
    api_keys = ctx.obj["api_keys"]
    account_ids = ctx.obj["account_ids"]
    departments = {}
    for api_key, account_id in zip(api_keys, account_ids):
        vehicles_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles"
        headers = {"Authorization": f"Bearer {api_key}"}
        skyhost_vehicles_request = run_request(vehicles_url, params=None, headers=headers)
        if skyhost_vehicles_request.status_code != 200:
            continue

        for skyhost_vehicle in skyhost_vehicles_request.json().get("items"):
            vehicle_details_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles/{skyhost_vehicle.get('id')}/details"
            vehicle_response = run_request(vehicle_details_url, headers=headers, params=None)
            if vehicle_response.status_code != 200:
                continue

            vehicle_details = vehicle_response.json()
            if department := vehicle_details.get("department"):
                address_response = department.get("address")
                if address_response is None:
                    continue
                departments[address_response.get("address")] = address_response

    for address, address_info in departments.items():
        if not session.query(AllowedStarts).filter(AllowedStarts.address == address).first():
            session.add(
                AllowedStarts(
                    address=address,
                    latitude=address_info["latitude"],
                    longitude=address_info["longitude"],
                    addition_date=datetime.now()
                )
            )
            session.commit()


@cli.command()
@click.pass_context
def set_roundtrips_v2(ctx):
    """
    Function to handle the aggreagtion of trips to roundtrips with new api
    """
    session = ctx.obj["Session"]()
    api_keys = ctx.obj["api_keys"]
    account_ids = ctx.obj["account_ids"]
    max_date = datetime.fromisoformat(os.getenv("MAX_DATE", "2024-05-01"))
    now = datetime.now()
    query_vehicles = (
        session.query(
            Cars.id,
            Cars.imei,
            Cars.location,
            func.coalesce(func.max(RoundTrips.end_time), max_date).label("max_date"),
        )
        .filter(
            and_(
                or_(Cars.deleted == False, Cars.deleted == 0, Cars.deleted == None),
                or_(Cars.disabled == False, Cars.disabled == 0, Cars.disabled == None),
            ),
            Cars.omkostning_aar.isnot(None),
            or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
            Cars.location.isnot(None)
        )
        .group_by(Cars.id, Cars.location, Cars.imei)
        .outerjoin(RoundTrips, RoundTrips.car_id == Cars.id)
    )

    allowed_starts = get_allowed_starts_with_additions(session)
    vehicles_imeis = {str(veh.imei): veh for veh in query_vehicles}  #  we got to identify by imei / externalid since Skyhost removed their legacy id
    known_imeis = list(vehicles_imeis.keys())
    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0
    for api_key, account_id in zip(api_keys, account_ids):
        vehicles_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles"
        headers = {"Authorization": f"Bearer {api_key}"}
        skyhost_vehicles_request = run_request(vehicles_url, params=None, headers=headers)
        if skyhost_vehicles_request.status_code != 200:
            continue

        skyhost_vehicles = skyhost_vehicles_request.json().get("items")
        for skyhost_vehicle in skyhost_vehicles:
            if str(skyhost_vehicle.get("externalId")) not in known_imeis:
                continue
            skyhost_device_id = skyhost_vehicle.get("id")
            saved_vehicle = vehicles_imeis[str(skyhost_vehicle.get("externalId"))]
            trips = get_trips_v2(
                from_date=saved_vehicle.max_date,
                to_date=now,
                url=f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles/{skyhost_device_id}/reports/milagetrip",
                headers=headers,
                car_id=saved_vehicle.id
            )
            if len(trips) == 0:
                continue

            car_trips = sanitise_for_overlaps(trips, summer_times, winter_times)
            (
                usage_count,
                possible_count,
                usage_distance,
                possible_distance,
            ) = process_car_roundtrips(
                saved_vehicle,
                car_trips,
                allowed_starts,
                aggregator,
                score,
                session,
                is_session_maker=False,
                # save=False
            )
            collected_route_count += usage_count
            collected_trip_count += possible_count
            collected_route_length += usage_distance
            collected_trip_length += possible_distance
    print("*****************" * 3)
    print(
        f"Collected route count {collected_route_count},    Collected trip count {collected_trip_count}      "
        f"ratio {collected_route_count / max(collected_trip_count, 1)}"
    )
    print(
        f"Collected route length {collected_route_length},    Collected trip length {collected_trip_length}      "
        f"ratio {collected_route_length / max(collected_trip_length, 1)}"
    )



@cli.command()
@click.pass_context
def set_roundtrips(ctx):
    """
    Function to handle the aggregation of trips to roundtrips
    """
    engine = ctx.obj["engine"]
    session_maker: sessionmaker[Session] = ctx.obj["Session"]
    cars = pd.read_sql(
        Query(Cars)
        .filter(Cars.omkostning_aar.isnot(None), Cars.location.isnot(None))
        .statement,
        engine,
    )

    with session_maker() as session:
        banned_cars = (
            session.query(Cars.id)
            .filter(or_(Cars.deleted == True, Cars.disabled == True))
            .all()
        )

    carid2key = {}
    for key in to_list(ctx.obj["SOAP_KEY"]):
        agent = SoapAgent(key)
        while (r := agent.execute_action("Trackers_GetAllTrackers")).status_code != 200:
            print("Retrying Trackers_GetAllTrackers")
        trackers = Trackers()
        trackers.parse(r.text)
        if len(trackers.block) == 0:
            continue
        carid2key.update({str(a): key for a in trackers.frame.ID.values})

    allowed_starts = get_allowed_starts_with_additions(session)

    collected_trip_length = 0
    collected_trip_count = 0
    collected_route_length = 0
    collected_route_count = 0

    only_natural = json.loads(os.getenv("ONLY_NATURAL", "false"))

    for car in cars.itertuples():
        if (
            str(car.id) not in carid2key
            or pd.isna(car.omkostning_aar)
            or pd.isna(car.location)
            or car.id in banned_cars
        ):
            continue
        with engine.connect() as conn:
            max_date = conn.execute(
                text(
                    f"select max(roundtrips.end_time) from roundtrips where car_id = {car.id}"
                )
            ).fetchone()[0]
        current_trips = get_trips(
            car.id, key=carid2key[str(car.id)], from_date=max_date
        )
        # test which aggregates the most
        if len(current_trips) == 0:
            continue

        car_trips = sanitise_for_overlaps(current_trips, summer_times, winter_times)
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
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=False)
def set_trackers_v2(ctx, description_fields=None):
    session = ctx.obj["Session"]()
    api_keys = ctx.obj["api_keys"]
    account_ids = ctx.obj["account_ids"]
    if description_fields is not None:
        description_fields = description_fields.spliti(",")
    else:
        description_fields = []

    cars_in_db = session.query(Cars).all()
    banned_cars = [str(car.id) for car in session.query(Cars.id).filter(or_(Cars.deleted == True, Cars.disabled == True)).all()]

    for account_id, api_key in zip(account_ids, api_keys):
        vehicle_list_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles"
        headers = {"Authorization": f"Bearer {api_key}"}
        vehicles_list_response = run_request(vehicle_list_url, headers=headers, params=None)
        if vehicles_list_response.status_code != 200:
            continue

        vehicles = vehicles_list_response.json().get("items")
        for vehicle_from_skyhost in vehicles:
            imei = vehicle_from_skyhost.get("externalId")
            skyhost_id = vehicle_from_skyhost.get("id")
            car_db = list(filter(lambda car: car.imei == imei, cars_in_db))
            if len(car_db) > 1:
                logger.error(f"There are multiple cars with the same imei number {imei}")
                continue
            if len(car_db) == 1 and str(car_db[0].id) in banned_cars:
                continue

            vehicle_details_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles/{skyhost_id}/details"
            vehicle_response = run_request(vehicle_details_url, headers=headers, params=None)
            if vehicle_response.status_code != 200:
                continue

            vehicle_details = vehicle_response.json()
            vehicle_details.update(**vehicle_from_skyhost)
            make, model = None, None

            known_car = False
            # the new object from skyhost rest does not support "old" id format, hence we use the external imei
            if len(car_db) == 0:
                id_ = imei
            else:
                known_car = True
                id_ = car_db[0].id
                make = car_db[0].make
                model = car_db[0].model

            plate = vehicle_from_skyhost.get("details", {}).get("regNo")
            if plate is None and car_db:
                plate = car_db[0].plate
            if plate is None:
                description_plate_pattern = re.search(r"\w{2}\d{5}", vehicle_from_skyhost.get("description", ""))
                plate = None if description_plate_pattern is None else description_plate_pattern.group()

            keys_updated_from_dmr_info = []
            vehicle_dmr_info = {}
            if make is None or model is None and plate:
                vehicle_dmr_info = get_splate_info_from_api(plate)
                sleep(1)
                make = vehicle_dmr_info.get("make", make)
                model = vehicle_dmr_info.get("model", model)
                keys_updated_from_dmr_info += ["make", "model"]

            v_type, keys_updated_from_dmr_info = get_vehicle_type(
                vehicle_details.get("details", {}).get("environmentalDetails"),
                dmr_info=vehicle_dmr_info,
                keys_updated_from_dmr=keys_updated_from_dmr_info
            )
            fuel, keys_updated_from_dmr_info = get_vehicle_fuel(
                vehicle_details.get("details", {}).get("environmentalDetails"),
                dmr_info=vehicle_dmr_info,
                keys_updated_from_dmr=keys_updated_from_dmr_info
            )
            wltp_el, keys_updated_from_dmr_info = get_vehicle_wltp(
                vehicle_details.get("details", {}),
                "el",
                dmr_info=vehicle_dmr_info,
                keys_updated_from_dmr=keys_updated_from_dmr_info
            )
            wltp_fossil, keys_updated_from_dmr_info = get_vehicle_wltp(
                vehicle_details.get("details", {}), "fossil",
                dmr_info=vehicle_dmr_info,
                keys_updated_from_dmr=keys_updated_from_dmr_info
            )
            range_km = get_electrical_range(vehicle_details.get("details"))
            car = dict(
                id=id_,
                imei=imei,
                plate=plate,
                make=make,
                model=model,
                description=" ".join(
                    [
                        attr
                        for field in description_fields
                        if (attr := vehicle_details.get(field))
                    ]
                ),
                location=get_location_id(vehicle_details.get("department"), session),
                km_aar=calcluate_km_aar(vehicle_details.get("leasing")),
                end_leasing=get_leasing_date(vehicle_details.get("leasing"), "endDate"),
                start_leasing=get_leasing_date(vehicle_details.get("leasing"), "startDate"),
                leasing_type=1 if vehicle_details.get("leasing", {}).get("endDate") is not None else None,
                type=v_type,
                fuel=fuel,
                wltp_fossil=None if wltp_fossil is None else round(wltp_fossil, 2),
                wltp_el=None if wltp_el is None else round(wltp_el, 2),
                range=None if range_km is None else round(range_km, 2),
            )

            if not is_car_valid(car):
                continue

            if known_car:
                # update if values are different and not none
                update_car(car, session, keys_updated_from_dmr_info)
            else:
                # insert unknown valid car
                insert_car(car, session)


@cli.command()
@click.pass_context
@click.option("-df", "--description-fields", envvar="DESCRIPTION_FIELDS", required=False)
def set_trackers(ctx, description_fields=None):
    """
    Loads the trackers, which in SkyHost terms is equivalent to a vehicle in their system.
    Due to the limitation on data served through their api, it heavily relies on supporting data.

    It is recommended to first run set_trackers to then manually update the Cars frame with associated data.

    AllowedStarts: is an essential part, which should be stored in a dataframe in pickle format, like:
                id, address, latitude, longitude
    Cars: relies on an associated AllowedStarts, i.e. its home location. If this pickle is not provided, only id of
            the vehicle will be stored with no relationship to a start.
    """
    Session = ctx.obj["Session"]
    if description_fields is not None:
        description_fields = description_fields.split(",")
    else:
        description_fields = []

    for key in to_list(ctx.obj["SOAP_KEY"]):
        agent = SoapAgent(key)
        trackers = Trackers()

        default_cars = pd.read_sql(Query(Cars).statement, ctx.obj["engine"])
        while (r := agent.execute_action("Trackers_GetAllTrackers")).status_code != 200:
            print("Retrying Trackers_GetAllTrackers")
        trackers.parse(r.text)
        with Session() as sess:
            banned_cars = (
                sess.query(Cars.id)
                .filter(or_(Cars.deleted == True, Cars.disabled == True))
                .all()
            )

        for tracker in trackers.frame.itertuples():
            if tracker.ID in banned_cars:
                continue
            plate = tracker.Marker if tracker.Marker is not None and re.match(r"\w{2}\d{5}", str(tracker.Marker)) else None
            if plate is None:
                description_plate_pattern = re.match(r"\w{2}\d{5}", str(tracker.Description))
                plate = None if description_plate_pattern is None else description_plate_pattern.group()
            # some times plate is in tracker.Marker
            car = dict(
                id=tracker.ID,
                imei=tracker.IMEI,
                plate=plate,
                description=" ".join(
                    [
                        attr
                        for field in description_fields
                        if (attr := tracker._asdict().get(field))
                    ]
                ),
                # todo add the additional parameters when they're exposed by SkyHost
                # todo update if meta data on car changed
            )
            if (
                tracker.Description in default_cars.plate.values
                or int(tracker.ID) in default_cars.id.values
            ):
                # we already know the car
                # only thing we can update by now is the imei
                saved_vehicle_object = sess.get(Cars, int(tracker.ID))
                if saved_vehicle_object:
                    saved_vehicle_object.imei = car.get("imei")
                    if (plate and saved_vehicle_object.plate is None) or (
                            plate and saved_vehicle_object.plate is not None and plate != saved_vehicle_object.plate
                    ):
                        saved_vehicle_object.plate = plate
                    description = car.get("description")
                    if (description and saved_vehicle_object.description is None) or (
                            description and saved_vehicle_object.description is not None and description != saved_vehicle_object.description
                    ):
                        saved_vehicle_object.description = description
                    sess.commit()
            else:
                # the car has not been seen before
                get_or_create(Session, Cars, car)


def get_trips(car_id, key, from_date=None):
    current_time = datetime.now()
    min_time = datetime(
        year=2022, month=2, day=24
    )  # 23/2 seems to be the date from which lat, lon is added
    if from_date is None or from_date < min_time:
        from_date = min_time

    agent = SoapAgent(key)

    trips = []
    for k, (start_log_time, end_log_time) in enumerate(
        date_iter(from_date, current_time, week_period=52)
    ):
        print(start_log_time, end_log_time)
        dbook = driving_book(
            car_id,
            start_log_time.isoformat(),
            end_log_time.isoformat(),
            agent,
        )

        if not all(
            [
                "StartPos_sLat" in dbook.columns,
                "StartPos_sLon" in dbook.columns,
                "StopPos_Timestamp" in dbook.columns,
            ]
        ):
            continue

        trimmed = dbook[
            (dbook.StartPos_sLat.notnull())
            & (dbook.StartPos_sLon.notnull())
            & (dbook.StopPos_Timestamp.notnull())
        ]
        length_trimmed = len(trimmed)
        length_dbook = len(dbook)
        if length_trimmed != length_dbook:
            if length_trimmed == length_dbook - 1:
                # if the missing attribute entry is the last, we cut it and continue
                missing_attributes_entry = dbook[~dbook.ID.isin(trimmed.ID.values)]
                if (
                    missing_attributes_entry.iloc[0].ID
                    == dbook.sort_values("StartPos_Timestamp", ascending=False)
                    .iloc[0]
                    .ID
                    and pd.isna(missing_attributes_entry.iloc[0].StartPos_Timestamp)
                    is False
                ):
                    dbook = dbook.sort_values(
                        "StartPos_Timestamp", ascending=False
                    ).iloc[1:]
            else:
                print(
                    f"Car {car_id} did not have lat, lon or StopPost_Timestamp in all "
                    f"logs between {start_log_time} - {end_log_time}"
                )
                break
        db_length = len(dbook)
        for idx, trip in enumerate(dbook.itertuples()):
            # check for none types in date (will ruin the aggreagtion)
            # allow if it's the last
            if ((not trip.StartPos_Timestamp or not trip.StopPos_Timestamp) and
                    (db_length != idx + 1 or current_time != end_log_time)):
                logger.error(f"ERROR IN THE LOGS FROM SKYHOST {trip.ID } DID NOT HAVE TIMESTAMPS")
                return pd.DataFrame()
            elif not trip.StartPos_Timestamp or not trip.StopPos_Timestamp:
                continue

            st = fix_time(
                datetime.strptime(trip.StartPos_Timestamp, "%Y-%m-%dT%H:%M:%S")
            )
            et = fix_time(
                datetime.strptime(trip.StopPos_Timestamp, "%Y-%m-%dT%H:%M:%S")
            )
            trips.append(
                dict(
                    id=trip.ID,
                    car_id=car_id,
                    distance=int(trip.Meters) / 1000,
                    start_time=st,
                    end_time=et,
                    start_latitude=float(trip.StartPos_sLat),
                    start_longitude=float(trip.StartPos_sLon),
                    end_latitude=None,
                    end_longitude=None,
                    # todo add start location when we get it
                )
            )

    if len(trips) == 0:
        return pd.DataFrame()
    trips_frame = pd.DataFrame(trips)
    trips_frame["end_latitude"] = trips_frame["start_latitude"].tolist()[1:] + [None]
    trips_frame["end_longitude"] = trips_frame["start_longitude"].tolist()[1:] + [None]
    # we do not return the last trip with no end lat / lon
    return trips_frame.iloc[:-1]


@cli.command()
@click.pass_context
def set_trips(ctx):
    """
    Function for pulling the driving log (kørebog)
    """
    Session = ctx.obj["Session"]
    engine = ctx.obj["engine"]
    for key in to_list(ctx.obj["SOAP_KEY"]):
        agent = SoapAgent(key)
        while (r := agent.execute_action("Trackers_GetAllTrackers")).status_code != 200:
            print("Retrying Trackers_GetAllTrackers")
        trackers = Trackers()
        trackers.parse(r.text)
        start_time = {}
        start_pos = {}
        current_time = datetime.now()
        min_time = datetime(
            year=2022, month=2, day=24
        )  # 23/2 seems to be the date from which lat, lon is added
        with Session() as sess:
            q = (
                Query(
                    [Trips.car_id, func.max(Trips.end_time).label("latest_time")]
                ).group_by(Trips.car_id)
            ).subquery()
            s = Query(
                [
                    func.coalesce(Trips.end_latitude, None),
                    func.coalesce(Trips.end_longitude, None),
                    q,
                    Trips.id,
                ]
            ).join(
                q, (Trips.car_id == q.c.car_id) & (Trips.end_time == q.c.latest_time)
            )
            for a in sess.execute(s):
                start_time[str(a[2])] = a[-2]
                if any([a[0] is None, a[1] is None]):
                    start_pos[str(a[2])] = {
                        "end_latitude": None,
                        "end_longitude": None,
                        "end_time": a[3],
                        "id": a[-1],
                    }

        cars = pd.read_sql(
            Query(Cars).filter(Cars.id.in_(trackers.frame.ID.values)).statement, engine
        )
        for car in cars.itertuples():
            with engine.connect() as conn:
                max_date = conn.execute(
                    text(
                        f"select max(roundtrips.end_time) from roundtrips where car_id = {car.id}"
                    )
                ).fetchone()[0]
            if max_date:
                start_time[str(car.id)] = max_date
            trips = []
            for k, (start_month, end_month) in enumerate(
                date_iter(
                    start_time.get(str(car.id), min_time), current_time, week_period=52
                )
            ):
                print(start_month, end_month)
                dbook = driving_book(
                    car.id,
                    start_month.isoformat(),
                    end_month.isoformat(),
                    agent,
                )

                if not all(
                    [
                        "StartPos_sLat" in dbook.columns,
                        "StartPos_sLon" in dbook.columns,
                        "StopPos_Timestamp" in dbook.columns,
                    ]
                ):
                    continue

                trimmed = dbook[
                    (dbook.StartPos_sLat.notnull())
                    & (dbook.StartPos_sLon.notnull())
                    & (dbook.StopPos_Timestamp.notnull())
                ]

                if len(trimmed) != len(dbook):
                    print(
                        f"Car {car.id} did not have lat, lon or StopPost_Timestamp in all "
                        f"logs between {start_month} - {end_month}"
                    )
                    break
                for trip in dbook.itertuples():
                    st = fix_time(
                        datetime.strptime(trip.StartPos_Timestamp, "%Y-%m-%dT%H:%M:%S")
                    )
                    et = fix_time(
                        datetime.strptime(trip.StopPos_Timestamp, "%Y-%m-%dT%H:%M:%S")
                    )
                    trips.append(
                        dict(
                            id=trip.ID,
                            car_id=car.id,
                            distance=int(trip.Meters) / 1000,
                            start_time=st,
                            end_time=et,
                            start_latitude=trip.StartPos_sLat,
                            start_longitude=trip.StartPos_sLon,
                            end_latitude=None,
                            end_longitude=None,
                            # todo add start location when we get it
                        )
                    )

            if len(trips) == 0:
                continue
            trips_frame = pd.DataFrame(trips)
            trips_frame["end_latitude"] = trips_frame["start_latitude"].tolist()[1:] + [
                None
            ]
            trips_frame["end_longitude"] = trips_frame["start_longitude"].tolist()[
                1:
            ] + [None]
            with Session.begin() as sess:
                updated_trips = []
                if str(car.id) in start_pos:
                    update_trip = sess.query(Trips).filter(
                        Trips.id == start_pos[str(car.id)]["id"]
                    )
                    for pulled_trip in update_trip:
                        updated_trips.append(pulled_trip.id)
                        end_lat, end_lon = trips_frame.sort_values(
                            ["end_time"], ascending=True
                        ).iloc[0][["start_latitude", "start_longitude"]]
                        setattr(pulled_trip, "end_latitude", end_lat)
                        setattr(pulled_trip, "end_longitude", end_lon)
                    sess.commit()
                add_these = [
                    Trips(**trip)
                    for trip in trips_frame.to_dict("records")
                    if trip["id"] not in updated_trips
                ]
                print(
                    f"adding {len(trips)} for car: {car.id}\nupdating {len(updated_trips)} trip with end_lat & end_lon\n",
                    flush=True,
                )
                sess.add_all(add_these)
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
    Function to test the precision of added parking spots
    """
    carids = [str(car.id) for car in cars]
    carid2key = {}
    for key in keys:
        if len(carid2key) == len(cars):
            break
        agent = SoapAgent(key)
        while (r := agent.execute_action("Trackers_GetAllTrackers")).status_code != 200:
            print("Retrying Trackers_GetAllTrackers")
        trackers = Trackers()
        trackers.parse(r.text)
        if len(trackers.block) == 0 or len(trackers.frame[trackers.frame.ID.isin(carids)]) == 0:
            continue
        carid2key.update({str(a): key for a in trackers.frame[trackers.frame.ID.isin(carids)].ID.values})

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

        current_trips = get_trips(
            car.id, key=carid2key[str(car.id)], from_date=start_date
        )

        if len(current_trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue

        car_trips = sanitise_for_overlaps(current_trips, summer_times, winter_times)

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


def location_precision_test_v2(
        session: Session,
        keys: list[str],
        location: int,
        cars: list,
        test_specific_start: AllowedStartSchema,
        start_date: date | datetime
):
    """
    Function to test the precision of added parking spots with the new api
    """
    if len(keys) % 2 != 0:
        # syntax in env is accountid1,apikey1,accountid2,apikey2 etc.
        raise MissingAccountIdOrKeyError("Expected an equal number of account ids and keys")

    car_imeis = [str(car.imei) for car in cars]
    carimei2key = {}
    account_ids = keys[::2]
    api_keys = keys[1::2]

    now = datetime.now()

    for account_id, api_key in zip(account_ids, api_keys):
        if len(carimei2key) == len(cars):
            break
        vehicle_url = f"https://api.skyhost.dk/accounts/{account_id}/resources/vehicles"
        headers = {"Authorization": f"Bearer {api_key}"}
        vehicles_response = run_request(vehicle_url, headers=headers, params=None)
        if vehicles_response.status_code != 200:
            continue
        vehicles_response = vehicles_response.json().get("items", [])
        if len(vehicles_response) == 0 or len([veh for veh in vehicles_response if str(veh.get("externalId")) in car_imeis]) == 0:
            continue

        carimei2key.update(
            {
                str(veh.get("externalId")): {
                    "account_id": account_id,
                    "api_key": api_key,
                    "skyhost_device_id": veh.get("id")
                } for veh in vehicles_response if str(veh.get("externalId")) in car_imeis}
        )

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
        if str(car.imei) not in carimei2key:
            logger.info(f"Car imei {car.imei} not found in trackers amongst the keys")
            print(f"Car imei {car.imei} not found in trackers amongst the keys")
            continue

        vehicle_info = carimei2key[str(car.imei)]
        url = f"https://api.skyhost.dk/accounts/{vehicle_info['account_id']}/resources/vehicles/{vehicle_info.get('skyhost_device_id')}/reports/milagetrip"
        headers = {"Authorization": f"Bearer {vehicle_info['api_key']}"}
        trips = get_trips_v2(
            from_date=start_date,
            to_date=now,
            url=url,
            headers=headers,
            car_id=car.id
        )

        if len(trips) == 0:
            logger.info(f"Car id {car.id} had no trips from date {start_date} until now")
            yield {
                "car_id": car.id,
                "precision": 0,
                "kilometers": 0
            }
            continue
        print(
            "Found {} trips for tracker with id {}".format(len(trips), car.id)
        )
        car_trips = sanitise_for_overlaps(trips, summer_times, winter_times)
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
