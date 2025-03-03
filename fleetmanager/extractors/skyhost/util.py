import requests
import logging
import numpy as np
from sqlalchemy.orm import Query, Session
from fleetmanager.extractors.skyhost.parsers import DrivingBook, MileageLogPositions
import ast
import pandas as pd
from sqlalchemy import func
from datetime import datetime, timezone, timedelta, date
from time import sleep
from typing import Literal, TypedDict
import pytz
from fleetmanager.data_access import LeasingTypes, FuelTypes, VehicleTypes, AllowedStarts, Cars

logger = logging.getLogger(__name__)

cph = pytz.timezone("Europe/Copenhagen")
utc = pytz.utc
summer_times = [
    date(2021, 3, 28),
    date(2022, 3, 27),
    date(2023, 3, 26),
    date(2024, 3, 31),
    date(2025, 3, 30),
    date(2026, 3, 29),
    date(2027, 3, 28),
]
winter_times = [
    date(2021, 10, 31),
    date(2022, 10, 30),
    date(2023, 10, 29),
    date(2024, 10, 27),
    date(2025, 10, 26),
    date(2026, 10, 25),
    date(2027, 10, 31),
]
anhour = timedelta(hours=1)

back_ref_types = {
    "leasing_type": LeasingTypes,
    "fuel": FuelTypes,
    "type": VehicleTypes,
    "location": AllowedStarts
}


class MileageTripResponseError(Exception):
    pass

class MissingAccountIdOrKeyError(Exception):
    pass

leasing_object = TypedDict(
    "leasing_object",
    {
        "contractMileage": int,
        "startDate": str,
        "endDate": str
    }
)

env_details_object = TypedDict(
    "env_details_object",
    {
        "fuelType": Literal["Petrol", "Diesel", "Electric", "Hydrogen"],
        "fuelConsumption": float,
        "fuelConsumptionUnit": Literal["LitersPer100Km", "KWhPer100Km", "KgPer100Km"],
        "co2EmmisionKgPerKm": float,
    }
)
useabilityDetails_object = TypedDict(
    "useabilityDetails_object",
    {
        "rangeOnFullTank": float,
        "fuelCapacity": float,
        "fuelCapacityUnit": Literal["Litres", "kWh", "kg"]
    }
)
details_object = TypedDict(
    "details_object",
    {
        "regNo": str,
        "environmentalDetails": env_details_object,
        "useabilityDetails": useabilityDetails_object
    }
)

address_object = TypedDict(
    "address_object",
    {
        "address": str,
        "latitude": float,
        "longitude": float
    }
)

department_object = TypedDict(
    "department_object",
    {
        "no": str,
        "name": str,
        "description": str,
        "address": address_object
    }
)


def get_trips_v2(from_date: datetime, to_date: datetime, url: str, headers: dict, car_id: int):
    original_url = url
    trips = []
    tId = 0
    for start_date, end_date in date_iter(from_date, to_date, week_period=52):
        params = {
            "from": start_date.isoformat(),
            "to": end_date.isoformat()
        }
        while True:
            response = run_request(uri=url, headers=headers, params=params)
            if response.status_code != 200:
                raise MileageTripResponseError(f"Did not receive successful response from Skyhost API: {response.status_code}")

            for trip in response.json().get("items"):
                trips.append(
                    dict(
                        id=tId,
                        car_id=car_id,
                        distance=int(trip.get("tripDistanceMeters")) / 1000,
                        start_time=fix_time(datetime.strptime(trip.get("start"), "%Y-%m-%dT%H:%M:%S%z")),
                        end_time=fix_time(datetime.strptime(trip.get("end"), "%Y-%m-%dT%H:%M:%S%z")),
                        start_latitude=trip.get("startAddress", {}).get("lat"),
                        start_longitude=trip.get("startAddress", {}).get("lon"),
                        end_latitude=trip.get("endAddress", {}).get("lat"),
                        end_longitude=trip.get("endAddress", {}).get("lon")
                    )
                )
                tId += 1
            if next_url := response.json().get("nextPageLink"):
                url = next_url
            else:
                url = original_url
                break
    logger.info("len trips from gettripsv2: {}".format(len(trips)))
    return trips


def fix_time(trip_time):
    if trip_time.tzinfo == timezone.utc:
        return trip_time.astimezone(cph)
    new_time = trip_time + (utc.localize(trip_time) - cph.localize(trip_time))
    if new_time.date() in winter_times and 1 <= trip_time.hour <= 2:
        new_time -= anhour
    elif new_time.date() in summer_times and new_time.hour == 2:
        new_time += anhour
    return new_time


def latest_time_query(Table):
    """
    Convenience function to get the last entry for cars
    """
    q = Query([Table.car_id, func.max(Table.end_time).label("lastest_time")]).group_by(
        Table.car_id
    )
    return q


def get_or_create(Session, model, parameters):
    """
    Convenience function to see if an entry already exists. Update it if it exists or else create it.
    returns the entry.
    """
    with Session.begin() as session:
        instance = session.query(model).filter_by(id=parameters["id"]).first()
        if instance:
            session.expunge_all()
    if instance:
        return instance
    else:
        instance = model(
            **{
                key: None if pd.isna(value) else value
                for key, value in parameters.items()
                if key in model.__dict__.keys()
            }
        )
        with Session.begin() as session:
            session.add(instance)
            session.commit()
        return instance


def to_list(env_string):
    if type(env_string) is str:
        return ast.literal_eval(env_string)
    return env_string


def get_coords(trip_id, agent):
    """
    Additional function if one needs to get logs further back than february 2022, since the MilageLog does not
    contain GPS coordinates.
    """
    while (
        r := agent.execute_action(
            "Trackers_GetMilagePositions", params={"MilageLogID": trip_id}
        )
    ).status_code != 200:
        logger.info(
            "Retrying Trackers_GetMilagePositions with MilageLogId: {}".format(trip_id),
        )
    log_pos = MileageLogPositions()
    log_pos.parse(r.text)
    return log_pos.frame.sort_values(by="Timestamp", ascending=True)


def driving_book(tracker_id, start_time, end_time, agent):
    """
    Function for pulling the MilageLog, which make up the entries in the Trips table
    """
    while (
        r := agent.execute_action(
            "Trackers_GetMilageLog",
            params={
                "TrackerID": tracker_id,
                "Begin": start_time,
                "End": end_time,
            },
        )
    ).status_code != 200:
        logger.info(
            "Retrying Trackers_GetMilageLog with TrackerID: {} Begin: {} End: {}".format(
                tracker_id, start_time, end_time
            )
        )
    book = DrivingBook()
    book.parse(r.text)
    logger.info(
        "Found {} trips for tracker with id {}".format(book.frame.shape[0], tracker_id)
    )
    if book.frame.shape[0] == 0:
        return book.frame
    else:
        return book.frame.sort_values(by="StartPos_Timestamp", ascending=True).replace(
            [np.nan], [None]
        )


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


def update_car(current_car: dict, session: Session, dmr_attributes: list):
    saved_car = session.get(Cars, current_car.get("id"))
    for key, value in current_car.items():
        if pd.isna(value):
            continue

        if getattr(saved_car, key) == value:
            continue

        if type(value) == str and len(value) == 0:
            continue

        if value != getattr(saved_car, key) and key in dmr_attributes:
            # we don't want to write DMR attributes if it's been changed elsewhere
            continue

        if key in back_ref_types.keys():
            setattr(saved_car, f"{key}_obj", session.get(back_ref_types[key], value))

        setattr(saved_car, key, value)
        session.commit()


def insert_car(current_car: dict, session: Session):
    for key, ref_type in back_ref_types.items():
        if back_ref_value := current_car.get(key):
            current_car.update(
                {f"{key}_obj": session.get(ref_type, back_ref_value)}
            )

    session.add(Cars(**current_car))


def get_electrical_range(details: details_object | None):
    vehicle_range = None
    if (
            details is None
            or details.get("useabilityDetails") is None
            or details.get("useabilityDetails", {}).get("rangeOnFullTank") is None
            or details.get("useabilityDetails", {}).get("fuelCapacityUnit", "") != "kWh"
    ):
        return vehicle_range
    if (
            details.get("useabilityDetails").get("fuelCapacityUnit") == 'kWh' and
            details.get("useabilityDetails").get("rangeOnFullTank") is not None
    ):
        return float(details.get("useabilityDetails").get("rangeOnFullTank"))
    wltp_el = get_vehicle_wltp(details, "el")
    if wltp_el is None:
        return vehicle_range
    full_tank_kwh = float(details.get("useabilityDetails", {}).get("rangeOnFullTank"))
    vehicle_range = (full_tank_kwh * 1000) / wltp_el
    return vehicle_range


def calcluate_wh_km_from_range(useabililty_details: useabilityDetails_object | None):
    if (
        useabililty_details is None or
        useabililty_details.get("rangeOnFullTank") is None or
        useabililty_details.get("fuelCapacity") is None or
        useabililty_details.get("fuelCapacityUnit") is None or
        useabililty_details.get("fuelCapacityUnit") != "kWh"
    ):
        return None
    wh_km_function = lambda fuel_capacity_kwh, range_full_tank: (fuel_capacity_kwh * 1000) / range_full_tank
    wh_pr_km = wh_km_function(
        float(useabililty_details.get("fuelCapacity")),
        float(useabililty_details.get("rangeOnFullTank"))
    )
    return wh_pr_km


def get_vehicle_wltp(details: details_object | None, wltp_key: Literal["el", "fossil"] = "el", dmr_info: dict = None, keys_updated_from_dmr: list = None):
    if keys_updated_from_dmr is None:
        keys_updated_from_dmr = []
    if details is None:
        return None
    env_details = details.get("environmentalDetails", {})
    wltp = None
    wltpKey_to_fuelType = {
        "el": ["Electric"],
        "fossil": ["Diesel", "Petrol"]
    }
    wltpKey_to_unit = {
        "el": "KWhPer100Km",
        "fossil": "LitersPer100Km"
    }
    unit_to_function = {
        "LitersPer100Km": lambda consumption_pr_100: 100 / consumption_pr_100,
        "KWhPer100Km": lambda kwh_pr_100km: (kwh_pr_100km * 1000) / 100,
    }
    if (
            env_details is None
            or env_details.get("fuelType") is None
            or env_details.get("fuelConsumptionUnit") is None
            or env_details.get("fuelConsumption") is None
    ):
        wltp = calcluate_wh_km_from_range(details.get("useabilityDetails"))
    if (
            wltp is None and
            env_details.get("fuelType") in wltpKey_to_fuelType[wltp_key] and
            env_details.get("fuelConsumption")
    ):
        unit = wltpKey_to_unit[wltp_key]
        wltp_function = unit_to_function[unit]
        wltp = wltp_function(float(env_details.get("fuelConsumption")))

    if wltp is None and dmr_info:
        drivkraft = dmr_info.get("drivkraft")
        if drivkraft in ["benzin", "diesel"] and wltp_key == 'fossil':
            keys_updated_from_dmr.append("wltp_fossil")
            return dmr_info.get("kml"), keys_updated_from_dmr
        elif drivkraft in ["el"] and wltp_key == 'el':
            keys_updated_from_dmr.append("wltp_el")
            return dmr_info.get("el_faktisk_forbrug"), keys_updated_from_dmr

    return wltp, keys_updated_from_dmr


def get_vehicle_type(env_details: env_details_object | None, dmr_info: dict = None, keys_updated_from_dmr: list = None):
    if keys_updated_from_dmr is None:
        keys_updated_from_dmr = []
    if dmr_info is None:
        dmr_info = {}
    fuelType_to_vehicleType = {
        "Petrol": 4,
        "Diesel": 4,
        "Electric": 3,
        "Hydrogen": None
    }
    dmr_to_type = {
        "diesel": 4,
        "benzin": 4,
        "el": 3,
        None: None
    }
    vehicle_type = None
    if env_details is None or env_details.get("fuelType") is None:
        drivkraft = dmr_info.get("drivkraft")
        if drivkraft in dmr_to_type:
            vehicle_type = dmr_to_type[drivkraft]
            keys_updated_from_dmr.append("type")
        return vehicle_type, keys_updated_from_dmr
    vehicle_type = fuelType_to_vehicleType[env_details.get("fuelType")]
    return vehicle_type, keys_updated_from_dmr


def get_vehicle_fuel(env_details: env_details_object | None, dmr_info: dict = None, keys_updated_from_dmr: list = None):
    if keys_updated_from_dmr is None:
        keys_updated_from_dmr = []
    if dmr_info is None:
        dmr_info = {}
    fuelType_to_vehicleType = {
        "Petrol": 1,
        "Diesel": 2,
        "Electric": 3,
        "Hydrogen": None
    }
    dmr_to_type = {
        "diesel": 2,
        "benzin": 1,
        "el": 3,
        None: None
    }
    fuel_type = None
    if env_details is None or env_details.get("fuelType") is None:
        drivkraft = dmr_info.get("drivkraft")
        if drivkraft in dmr_to_type:
            fuel_type = dmr_to_type[drivkraft]
            keys_updated_from_dmr.append("fuel")
        return fuel_type, keys_updated_from_dmr
    fuel_type = fuelType_to_vehicleType[env_details.get("fuelType")]
    return fuel_type, keys_updated_from_dmr


def get_leasing_date(leasing: leasing_object | None, date_key: Literal["startDate", "endDate"] = "endDate"):
    leasing_date = None
    if leasing is None or leasing.get(date_key) is None:
        return leasing_date
    leasing_date = datetime.fromisoformat(leasing.get(date_key))
    return leasing_date

def calcluate_km_aar(leasing: leasing_object | None):
    km_aar = None
    if leasing is None:
        return None
    start_leasing = leasing.get("startDate")
    end_leasing = leasing.get("endDate")
    contractMileage = leasing.get("contractMileage")
    if start_leasing and end_leasing and contractMileage:
        km_aar = int(contractMileage) / (
                (datetime.fromisoformat(end_leasing) - datetime.fromisoformat(start_leasing)).total_seconds() / 3600 / 24 / 365
        )
        km_aar = round(km_aar)
    return km_aar


def get_location_id(department: department_object | None, session: Session):
    location = None
    if department is None or department.get("address", {}) is None:
        return None
    if address := department.get("address", {}).get("address") is not None:
        location = session.query(AllowedStarts).filter(AllowedStarts.address == address).first()
        if location:
            return location.id
    return location


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
