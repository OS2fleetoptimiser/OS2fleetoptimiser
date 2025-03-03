import logging
import requests
from time import sleep
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


logger = logging.getLogger(__name__)


def load_dmr_request(plate: str):
    url = f"https://www.tjekbil.dk/api/v3/dmr/regnr/{plate}"
    headers = {
        "User-Agent": "FleetOptimiser/1.0"
    }
    results = requests.get(url, headers=headers)

    if results.status_code != 200:
        results = {}
    else:
        results = results.json()

    return results


def get_splate_info_from_api(plate: str) -> dict:
    result = {}
    result = load_dmr_request(plate)
    basic = result.get("basic", {})

    car_data = {}

    drivkraft = None
    if "drivkraftTypeNavn" in basic:
        drivkraft = basic.get("drivkraftTypeNavn")
        drivkraft = None if drivkraft is None else drivkraft.lower()
        car_data["drivkraft"] = drivkraft
    if drivkraft == 'el':
        wltp_el = basic.get("motorElektriskForbrug")
        if pd.isna(wltp_el):
            wltp_el = basic.get("motorElektriskForbrugMaalt")
        car_data["el_faktisk_forbrug"] = wltp_el
        try:
            car_data["elektrisk_rækkevidde"] = result.get("extended", {}).get("techical", {}).get("elektriskRaekkevidde") # there's a spelling mistake in response technical = techical
        except AttributeError:
            retry = 1
            max_retry = 4
            while max_retry > retry:
                result = load_dmr_request(plate)
                retry += 1
                if pd.isna(result.get("extended", {})):
                    continue
                else:
                    result.get("extended", {}).get("techical", {}).get(
                        "elektriskRaekkevidde")  # there's a spelling mistake in response technical = techical
                    break
    else:
        car_data["kml"] = basic.get("motorKmPerLiter")
    car_data["leasing_end"] = None if basic.get("leasingGyldigTil") is None else datetime.fromisoformat(basic.get("leasingGyldigTil"))
    car_data["make"] = basic.get("maerkeTypeNavn")
    car_data["model"] = " ".join([basic.get("modelTypeNavn", ""), basic.get("variantTypeNavn", "")]).strip()
    return car_data


def run_request(uri, params, headers=None):
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


def get_logs(vehicle_id: int | str, from_date: datetime, to_date: datetime, url: str, params: dict, weeks: int = 2):
    trips = []

    for start, end in date_iter(from_date, to_date, week_period=weeks):
        logger.info(f"     Pulling        {start}    -      {end}")
        params["StartDateYYYYMMDDHHMMSS"] = start.strftime("%Y%m%d%H%M%S")
        params["EndDateYYYYMMDDHHMMSS"] = end.strftime("%Y%m%d%H%M%S")
        params["VehicleId"] = vehicle_id
        response = run_request(uri=url, params=params)

        if response.status_code != 200:
            logger.warning(f"Trip request returned code {response.status_code}")
            trips = []
            break

        trips += response.json()

    return trips


def format_trip_logs(trips: list, vehicle_id: int):
    trips = pd.DataFrame(trips)
    logger.info(f"going from {len(trips)}")
    trips["TripEndDate"] = trips["TripEndDate"].replace('19700101010000', np.nan)
    trips["TripEndLatitude"] = trips["TripEndLatitude"].replace('', np.nan)
    trips["TripStartLongitude"] = trips["TripStartLongitude"].replace('', np.nan)
    trips.dropna(subset=["TripEndDate", "TripEndLatitude", "TripStartLongitude"], axis=0, inplace=True)
    if len(trips) == 0:
        logger.info(f"to no correct logs for vehicle {vehicle_id}")
        return []
    logger.info(f"to {len(trips)}")
    trips["start_latitude"] = trips.TripStartLatitude.astype(float)
    trips["start_longitude"] = trips.TripStartLongitude.astype(float)
    trips["end_latitude"] = trips.TripEndLatitude.astype(float)
    trips["end_longitude"] = trips.TripEndLongitude.astype(float)
    trips["distance"] = trips.Mileage.astype(float) / 1000
    trips["start_time"] = trips.TripStartDate.apply(lambda x: datetime.strptime(x, "%Y%m%d%H%M%S"))
    trips["end_time"] = trips.TripEndDate.apply(lambda x: datetime.strptime(x, "%Y%m%d%H%M%S"))
    trips.rename({"TripId": "id", "VehicleId": "car_id"}, axis=1, inplace=True)

    return trips[
        ["id", "car_id", "start_time", "end_time", "start_latitude", "start_longitude", "end_latitude", "end_longitude",
         "distance"]].to_dict("records")
