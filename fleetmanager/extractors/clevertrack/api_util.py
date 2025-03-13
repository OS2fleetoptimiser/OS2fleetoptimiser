import pandas as pd
from collections import OrderedDict
from datetime import date, datetime
import xmltodict
import requests
from tenacity import retry, wait_random_exponential, stop_after_attempt

from fleetmanager.extractors.fleetcomplete.updatedb import quantize_months
from fleetmanager.extractors.util import extract_plate
from fleetmanager.logging import logging


logger = logging.getLogger(__name__)


class DuplicatePlateCleverTrack(Exception):
    """
    Thrown when there are multiple items found with the same plate from the CleverTrack API
    """

    pass


class TripIdPatchError(Exception):
    """
    Thrown when the patch did not return the expected confirmation / number of ids
    """

    pass


@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
def get_vehicles(token: str):
    url = "https://ctpublic.azurewebsites.net/api/vehicles"
    header = {"token": token, "Accept": "application/json"}
    response = requests.get(url, headers=header)
    vehicles = None
    if response.status_code == 200:
        vehicles = response.json()
    return vehicles


@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(3))
def get_trips(token: str, start: str, stop: str = None):
    if stop is None:
        stop = date.today()
    url = f"https://ctpublic.azurewebsites.net/api/triplist?start={start}&stop={stop}"
    header = {"token": token, "Accept": "application/json"}
    response = requests.get(url, headers=header)
    trips = None
    if response.status_code == 200:
        trips = response.json()
        return trips.get("trips")
    return trips


@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(3))
def patch_trips(token: str, ids: list[int]):
    url = "https://ctpublic.azurewebsites.net/api/triplist"
    header = {"token": token}
    body = {"tripIDs": ids}
    response = requests.patch(url, json=body, headers=header)
    if response.status_code == 200:
        confirmation = (
            xmltodict.parse(response.content)
            .get("tripListAnswer")
            .get("tripIDs", {})
            .get("d2p1:int", [])
        )
        if isinstance(confirmation, str) and len(ids) == 1:
            confirmation = [confirmation]

        if len(confirmation) != len(ids):
            raise TripIdPatchError(
                f"Returned number of patched ids: {len(confirmation)} did not match the requested: {len(ids)}"
            )

        logger.info(f"Patched {len(ids)} ids.")
        return
    raise TripIdPatchError(
        f"Request did not return 200 response, but {response.status_code} and response {response.content}"
    )


def find_item_plate_list(plate: str, vehicles_list: OrderedDict) -> dict:
    car = list(
        filter(
            lambda car: plate in car.get("name", "")
            or plate in car.get("deviceType", ""),
            vehicles_list,
        )
    )
    if len(car) > 1:
        ids = [a["id"] for a in car]
        raise DuplicatePlateCleverTrack(
            f"There were found multiple vehicles with the plate {plate}, ids: {ids}"
        )
    if car:
        car = dict(car[0])
    else:
        car = {}
    return car


def parse_trips(trips_list: list) -> dict:
    car_to_trips = {}
    maschine_to_plate = {}
    visited = set()
    if trips_list is None:
        return car_to_trips

    for trip in trips_list:
        maschine = trip.get("maschine")  # they spell it like "maschine"
        if maschine not in visited:
            visited.add(maschine)
            plate = extract_plate(maschine)
            if plate is None:
                continue
            car_to_trips[plate] = []
            maschine_to_plate[maschine] = plate
        if maschine not in maschine_to_plate:
            continue
        plate = maschine_to_plate[maschine]
        car_to_trips[plate].append(
            {
                "plate": plate,
                "id": trip.get("tripNo"),
                "start_time": trip.get("startTimestamp"),
                "end_time": trip.get("stopTimestamp"),
                "distance": trip.get("distance"),
                "start_latitude": trip.get("startGeo", {}).get("lat"),
                "start_longitude": trip.get("startGeo", {}).get("lon"),
                "end_latitude": trip.get("stopGeo", {}).get("lat"),
                "end_longitude": trip.get("stopGeo", {}).get("lon"),
            }
        )
    return car_to_trips


def collect_trips(
    token: str,
    start_time: date | datetime,
    stop_time: date | datetime,
    day_delta: int = 1,
) -> pd.DataFrame:
    collected_trips = []

    for start, stop in quantize_months(start_time, stop_time, days=day_delta):
        logger.info(f"{start} - {stop}")
        trips_for_period = parse_trips(get_trips(token=token, start=start, stop=stop))
        collected_trips += [
            trip for car_trips in trips_for_period.values() for trip in car_trips
        ]

    collected_trips = pd.DataFrame(collected_trips)
    collected_trips["start_time"] = collected_trips.start_time.apply(
        lambda date_string: datetime.fromisoformat(date_string)
    )
    collected_trips["end_time"] = collected_trips.end_time.apply(
        lambda date_string: datetime.fromisoformat(date_string)
    )
    collected_trips["start_latitude"] = collected_trips.start_latitude.astype(float)
    collected_trips["start_longitude"] = collected_trips.start_longitude.astype(float)
    collected_trips["end_latitude"] = collected_trips.end_latitude.astype(float)
    collected_trips["end_longitude"] = collected_trips.end_longitude.astype(float)
    collected_trips["distance"] = collected_trips.distance.astype(float)
    collected_trips.drop_duplicates(["id"], inplace=True)
    return collected_trips
