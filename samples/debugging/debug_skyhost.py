import pandas as pd
from datetime import datetime

from fleetmanager.extractors.skyhost.soap_agent import SoapAgent
from fleetmanager.extractors.skyhost.parsers import Trackers, DrivingBook


def get_trackers(api_key):
    s = SoapAgent(api_key)
    s.execute_action("Trackers_GetAllTrackers")
    t = Trackers()
    t.parse(s.last_response.text)
    return t


def find_api_key_for_car(car_id, api_keys):
    for key in api_keys:
        s = SoapAgent(key)
        s.execute_action("Trackers_GetAllTrackers")
        t = Trackers()
        t.parse(s.last_response.text)
        if str(car_id) in t.frame.ID.values:
            return key

    return


def check_if_column_exist(frame: pd.DataFrame, value: str = "Marker"):
    return value in frame.columns


def load_trips(car_id, from_date: datetime, api_key, to_date=None):
    if not to_date:
        to_date = datetime.now()

    s = SoapAgent(api_key)
    r = s.execute_action("Trackers_GetMilageLog", params={
        "TrackerID": car_id,
        "Begin": from_date.isoformat(),
        "End": to_date.isoformat()
    })

    db = DrivingBook()
    db.parse(r.text)
    return db



if __name__ == '__main__':
    car_id = 45461
    start_time = datetime(2024, 12, 16)
    keys = []
    found_key = find_api_key_for_car(car_id, keys)
    trips = load_trips(car_id, from_date=start_time, api_key=found_key)
