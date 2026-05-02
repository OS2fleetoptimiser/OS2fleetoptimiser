import ast
import urllib.parse

from datetime import datetime
import pandas as pd
import regex as re
import requests
from pydantic import ValidationError
from sqlalchemy.orm import Session, selectinload

from fleetmanager.api.configuration.schemas import Vehicle
from fleetmanager.data_access import AllowedStarts, Cars, FuelTypes, LeasingTypes, VehicleTypes
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import calc_distance


logger = logging.getLogger(__name__)


BACK_REF_TYPES: dict = {
    "leasing_type": LeasingTypes,
    "fuel": FuelTypes,
    "type": VehicleTypes,
    "location": AllowedStarts,
}


def get_values(original_source: str) -> dict:
    car_data = {}
    if original_source is None:
        return car_data
    source = original_source.lower()
    kml = re.findall(r"opgivet forbrug</span>.*?<\/span>", source)
    if kml:
        car_data["kml"] = get_number(kml)
    co2udslip = re.findall(r"co2-udslip</span>.*?<\/span>", source)
    if co2udslip:
        car_data["co2"] = get_number(co2udslip)
    co = re.findall(r"co</span>.*?<\/span>", source)
    if co:
        car_data["co"] = get_number(co)
    nox = re.findall(r"nox</span>.*?<\/span>", source)
    if nox:
        car_data["nox"] = get_number(nox)
    el_faktisk_forbrug = re.findall(r"elektrisk forbrug målt</span>.*?<\/span>", source)
    if el_faktisk_forbrug:
        car_data["el_faktisk_forbrug"] = get_number(el_faktisk_forbrug)
    el_forbrug = re.findall(r"elektrisk forbrug</span>.*?<\/span>", source)
    if el_forbrug:
        car_data["elektrisk_forbrug"] = get_number(el_forbrug)
    el_range = re.findall(r"elektrisk rækkevidde</span>.*?<\/span>", source)
    if el_range:
        car_data["elektrisk_rækkevidde"] = get_number(el_range)
    drivkraft = re.findall(r"drivkraft</span>.*?<\/span>", source)
    if drivkraft:
        car_data["drivkraft"] = get_number(drivkraft)
    bil_titel = re.findall(
        r'(?<=<meta\sname\=\"title"\scontent\=\").*?(?=\s\|\stjekbil)', original_source
    )
    if bil_titel:
        car_data.update(get_make_model(bil_titel))

    return car_data


def get_make_model(title: list[str]) -> dict:
    if len(title) != 1:
        return None
    cleaned = re.sub(r"\w{2}\d{5}\s\-", "", title[0]).strip()
    # assume that there's only ever one word in the make
    car_make_model = {}
    try:
        make, model = cleaned.split()[0], " ".join(cleaned.split()[1:])
        car_make_model["make"] = make
        car_make_model["model"] = model
    except ValueError:
        # there's only one word in the cleaned/prepared
        car_make_model["make"] = cleaned

    return car_make_model


def get_number(list_found: list[str]) -> str | int:
    found = list_found[0].split("<span>")[-1].split()[0]
    if "<" in found:
        found = found.split("<")[0]
    return found


def find_in_settings(settings, find_key):
    if find_key in settings:
        return settings[find_key]
    for key, value in settings.items():
        if isinstance(value, dict):
            for k, v in value.items():
                if k == find_key:
                    return v


def get_latlon_address(address):
    """
    Fallback function if no gps coordination is associated with the address
    """
    osm_url = (
        "https://nominatim.openstreetmap.org/search?q="
        + urllib.parse.quote(address)
        + "&format=jsonv2"
    )
    headers = {
        "User-Agent": "FleetOptimiser/1.0"
    }
    response = requests.get(osm_url, headers=headers)
    if response.status_code != 200:
        logger.warning(f"calling {address} for OSM failed with error code {response.status_code},\nurl: {osm_url}")
        return None, None
    response = response.json()
    if len(response) == 0:
        logger.warning(f"could not find lat/lon for {address} with OSM,\nurl: {osm_url}")
        return None, None

    return float(response[0]["lat"]), float(response[0]["lon"])


def update_car(vehicle, saved_car):
    """returns true if saved car values are not equal to the new vehicle input"""
    for key, value in vehicle.items():
        if pd.isna(value) and pd.isna(saved_car[key]):
            continue
        if value != saved_car[key]:
            return True
    return False


def get_or_create(Session, model, parameters):
    """
    Search for an object in the db, create it if it doesn't exist
    return on both scenarios
    """
    with Session.begin() as session:
        instance = session.query(model).filter_by(id=parameters["id"]).first()
        if instance:
            session.expunge_all()
    if instance:
        return instance
    else:
        instance = model(**parameters)
        with Session.begin() as session:
            session.add(instance)
            session.commit()
        return instance


def to_list(env_string):
    if type(env_string) is str:
        return ast.literal_eval(env_string)
    return env_string


def logs_to_trips(puma_frame: pd.DataFrame, allowed_speed: int = 200) -> list[dict]:
    """
    Takes in a dataframe of individual gps logs and aggregates them to trips format. The input data is expected to
    contain timestamp, latitude & longitude. It's assumed that all logs in the frame is from the same vehicle.
    All logs with 0 gps coordinates will be discarded. GPS logging is sought cleaned by determining the travelling speed
    between two logs - all logs with > allowed_speed (km/h) will be discarded. Input is like
    fleetmanager.extractors.puma.pumaschema.Data, output is like fleetmanager.data_access.db_schema.Trips.
    """

    if len(puma_frame) == 0:
        return []

    frame = (
        puma_frame[(puma_frame.latitude != 0) & (puma_frame.longitude != 0)]
        .sort_values("timestamp", ascending=True)
        .copy()
    )

    # fix the wrong gps logs
    frame[["next_timestamp", "next_latitude", "next_longitude"]] = frame[
        ["timestamp", "latitude", "longitude"]
    ].shift(-1)
    frame = frame.iloc[:-1]
    if len(frame) == 0:
        return []
    frame["hours"] = frame.apply(
        lambda row: 1 / 3600 if row.next_timestamp == row.timestamp else (row.next_timestamp - row.timestamp).total_seconds() / 3600,
        axis=1
    )
    frame["distance"] = frame.apply(
        lambda row: calc_distance(
            (row.latitude, row.longitude), (row.next_latitude, row.next_longitude)
        ),
        axis=1
    )

    frame["km/h"] = frame.apply(
        lambda row: 0
        if row.distance == 0
        else float("{:.3f}".format(row.distance / row.hours)),
        axis=1
    )

    frame = frame[frame["km/h"] <= allowed_speed].copy().reset_index().iloc[:, 1:]

    if len(frame) == 0:
        return []

    frame["change"] = frame["ignition"].ne(
        frame["ignition"].shift()
    )  # find out when the ignition changes

    groups = list(map(lambda row: row.Index, frame[frame.change].itertuples()))
    groups = map(lambda index, index2: (index, index2 + 1), groups[:-1], groups[1:])
    # grouping for trips
    grouped = map(lambda indexes: frame.iloc[indexes[0]:indexes[1]], groups)

    grouped = filter(
        lambda group: group["ignition"].iloc[0] is not False
        and group["ignition"].iloc[-1] is not True,
        grouped,
    )  # get rid of the first recorded group if it doesn't start with true, and the last if it's not ended with false

    trips = [
        {
            "id": k,
            "start_time": group.iloc[0].timestamp,
            "end_time": group.iloc[-1].timestamp,
            "start_latitude": group.iloc[0].latitude,
            "start_longitude": group.iloc[0].longitude,
            "end_latitude": group.iloc[-1].latitude,
            "end_longitude": group.iloc[-1].longitude,
            "distance": group.distance.iloc[:-1].sum(),
        }
        for k, group in enumerate(grouped) if sum(group.ignition) / len(group) >= 0.5
    ]

    return trips


def generate_trips(original_df):
    """
    Take a Dataframe and the calc_distance function to create trips
    returns a new Dataframe with the following values:
    imei, start_time, end_time, distance, start_latitude, start_longitude, end_latitude, end_longitude
    """

    # Shifting latitude and longitude
    df = (
        original_df[(original_df.latitude != 0) & (original_df.longitude != 0)]
        .copy()
        .reset_index()
        .iloc[:, 1:]
    )
    if len(df) == 0:
        return []
    df.sort_values("timestamp", inplace=True, ascending=True)
    df[["prev_latitude", "prev_longitude"]] = df[["latitude", "longitude"]].shift()

    df["distance"] = df.apply(
        lambda row: calc_distance(
            (row.latitude, row.longitude), (row.prev_latitude, row.prev_longitude)
        ),
        axis=1,
    )

    # Grouping logic
    group_number = 0
    group_list = []
    include_first_false = False  # Flag to include only the first False after a True

    # Loop through DataFrame
    for i in range(len(df)):
        if i == 0:
            group_list.append(None)
            continue

        if df["ignition"][i] == True and df["ignition"][i - 1] == False:
            group_number += 1  # Start a new group
            include_first_false = True

        elif (
            df["ignition"][i] == False
            and df["ignition"][i - 1] == True
            and include_first_false
        ):
            group_list.append(group_number)
            include_first_false = (
                False  # Stop including additional Falses for this group
            )
            continue

        if include_first_false or df["ignition"][i]:
            group_list.append(group_number)
        else:
            group_list.append(None)

    if len(group_list) > 0 and group_list[-1] is not None and df["ignition"].iloc[-1]:
        # removing the
        remove_group = group_list[-1]
        group_list = list(
            map(
                lambda group_no: group_no if group_no != remove_group else None,
                group_list,
            )
        )

    df["group"] = group_list

    # Summary data collection
    group_summary_data = []
    for group_id, group in df.groupby("group"):
        if group_id is not None:
            start_latitude, start_longitude = (
                group["latitude"].iloc[0],
                group["longitude"].iloc[0],
            )
            end_latitude, end_longitude = (
                group["latitude"].iloc[-1],
                group["longitude"].iloc[-1],
            )
            start_time = group["timestamp"].iloc[0]
            end_time = group["timestamp"].iloc[-1]
            distance = group["distance"].sum()
            id_ = group["id"].iloc[0]

            # Append summary data to list
            group_summary_data.append(
                {
                    "id": id_,
                    "start_time": start_time,
                    "end_time": end_time,
                    "distance": distance,
                    "start_latitude": start_latitude,
                    "start_longitude": start_longitude,
                    "end_latitude": end_latitude,
                    "end_longitude": end_longitude,
                }
            )

    return group_summary_data


def extract_plate(maschine_string: str | None):
    if maschine_string is None:
        return
    plate_pattern = r'[A-Z]{2}\d{5}'
    match = re.search(plate_pattern, maschine_string)
    if match:
        match = maschine_string[match.span()[0]: match.span()[1]]
        if 'SM0' in match:  # unregistered machines will match on SM0\d{2}
            return
        return match
    return


def get_allowed_starts_with_additions(
        session: Session,
        exempt_location: int = None
):
    query = session.query(
        AllowedStarts
    ).options(
        selectinload(AllowedStarts.additions)
    )
    if exempt_location:
        query = query.filter(AllowedStarts.id != exempt_location)

    allowed_starts = []

    for start in query:
        allowed_starts.append(
            {
                "id": start.id,
                "latitude": start.latitude,
                "longitude": start.longitude
            }
        )
        for addition in start.additions:
            allowed_starts.append(
                {
                    "id": addition.allowed_start_id,
                    "latitude": addition.latitude,
                    "longitude": addition.longitude
                }
            )
    return allowed_starts

def vehicle_needs_dmr_data(saved_vehicle) -> bool:
    """
    returns true if the vehicle is missing key attributes that triggers a dmr lookup.
    If make, model, type and wltp (fossil or el) are all present, we skip dmr
    to avoid overriding data set directly via integration or user.
    """
    if saved_vehicle is None:
        return True

    def get_val(key):
        if hasattr(saved_vehicle, "get"):
            val = saved_vehicle.get(key)
        else:
            val = getattr(saved_vehicle, key, None)
        try:
            return None if pd.isna(val) else val
        except (TypeError, ValueError):
            return val

    has_make = get_val("make") is not None
    has_model = get_val("model") is not None
    has_type = get_val("type") is not None
    has_wltp = get_val("wltp_fossil") is not None or get_val("wltp_el") is not None

    return not (has_make and has_model and has_type and has_wltp)


def save_vehicle(car_dict: dict, session: Session, dmr_keys: list[str] = None):
    """
    Insert a new Cars record or update an existing one.

    car_dict should be a flat dict keyed by Cars column names. Any pre-built
    _obj relationship keys are ignored and resolved from the FK integer values.

    dmr_keys lists keys whose values came from the api.
    Those keys will not overwrite an existing non-null value in the db, so data
    set directly via integration or by user is never silently overwritten.
    """
    if dmr_keys is None:
        dmr_keys = []

    car_id = car_dict.get("id")
    saved_car = session.get(Cars, car_id)
    car_columns = set(Cars.__table__.columns.keys())

    if saved_car is None:
        insert_dict = {k: v for k, v in car_dict.items() if k in car_columns}
        for key, ref_type in BACK_REF_TYPES.items():
            if (val := insert_dict.get(key)) is not None:
                insert_dict[f"{key}_obj"] = session.get(ref_type, val)
        session.add(Cars(**insert_dict))
        session.commit()
        logger.info(f"Inserted new vehicle id={car_id}")
        return

    for key, value in car_dict.items():
        if key not in car_columns or key == "id":
            continue
        try:
            if pd.isna(value):
                continue
        except (TypeError, ValueError):
            pass
        if isinstance(value, str) and not value:
            continue
        if value == 0 and key != "disabled":
            continue
        if key in dmr_keys and getattr(saved_car, key, None) is not None:
            continue
        if getattr(saved_car, key, None) == value:
            continue
        setattr(saved_car, key, value)
        if key in BACK_REF_TYPES:
            setattr(saved_car, f"{key}_obj", session.get(BACK_REF_TYPES[key], value))

    session.commit()


def apply_dmr_data(car_dict: dict, dmr_info: dict) -> list[str]:
    """
    Fill missing fields in car_dict from dmr data.

    Only sets a field if it is currently None in car_dict. Returns the list
    of keys that were set, which should be passed as dmr_keys to save_vehicle
    so the same protection applies at the db level.
    """
    if not dmr_info:
        return []

    dmr_keys = []
    drivkraft = dmr_info.get("drivkraft")
    drivkraft_to_fuel = {"benzin": 1, "diesel": 2, "el": 3}
    drivkraft_to_type = {"benzin": 4, "diesel": 4, "el": 3}

    def set_if_missing(key, value):
        if car_dict.get(key) is None and value is not None:
            car_dict[key] = value
            dmr_keys.append(key)

    set_if_missing("make", dmr_info.get("make"))
    set_if_missing("model", dmr_info.get("model"))
    set_if_missing("fuel", drivkraft_to_fuel.get(drivkraft))
    set_if_missing("type", drivkraft_to_type.get(drivkraft))

    if car_dict.get("wltp_fossil") is None:
        car_dict["wltp_fossil"] = None if drivkraft == "el" else dmr_info.get("kml")
        dmr_keys.append("wltp_fossil")
    if car_dict.get("wltp_el") is None:
        el = (
            dmr_info.get("el_faktisk_forbrug")
            if "el_faktisk_forbrug" in dmr_info
            else dmr_info.get("elektrisk_forbrug")
        )
        car_dict["wltp_el"] = el
        dmr_keys.append("wltp_el")
    if car_dict.get("range") is None:
        car_dict["range"] = dmr_info.get("elektrisk_rækkevidde")
        dmr_keys.append("range")
    if car_dict.get("end_leasing") is None:
        car_dict["end_leasing"] = dmr_info.get("leasing_end")
        dmr_keys.append("end_leasing")

    # type/fuel are only meaningful when there is wltp data to back them up
    if (
        car_dict.get("type") is not None
        and car_dict.get("wltp_fossil") is None
        and car_dict.get("wltp_el") is None
    ):
        car_dict["type"] = None
        car_dict["fuel"] = None

    return dmr_keys


def is_car_valid(car_dict: dict) -> bool:
    """
    validate a car dict against the Vehicle pydantic schema.
    logs a warning and returns False if validation fails.
    """
    validation_dict = car_dict.copy()
    validation_dict["fuel"] = {"id": validation_dict.get("fuel")}
    validation_dict["type"] = {"id": validation_dict.get("type")}
    validation_dict["location"] = {"id": validation_dict.get("location")}
    validation_dict["leasing_type"] = {"id": validation_dict.get("leasing_type")}
    for key, value in car_dict.items():
        try:
            if pd.isna(value):
                validation_dict[key] = None
        except (TypeError, ValueError):
            pass
    try:
        Vehicle(**validation_dict)
    except ValidationError as e:
        logger.warning(
            f"\n\n**************************************\n"
            f"Could not validate vehicle {car_dict.get('id')}\n"
            f"{e}\n"
            f"{car_dict}\n\n"
            f"Not saving/updating the vehicle\n"
            f"**************************************\n\n"
        )
        return False
    return True


def get_plate_info_from_api(plate: str) -> dict:
    # "techical" is a typo in the API response (should be "technical")
    _EL_RANGE_KEY = "elektriskRaekkevidde"

    def _fetch():
        url = f"https://www.tjekbil.dk/api/v3/dmr/regnr/{plate}"
        r = requests.get(url, headers={"User-Agent": "FleetOptimiser/1.0"})
        return r.json() if r.status_code == 200 else {}

    result = _fetch()
    basic = result.get("basic") or {}

    drivkraft_raw = basic.get("drivkraftTypeNavn")
    drivkraft = drivkraft_raw.lower() if drivkraft_raw else None
    car_data: dict = {"drivkraft": drivkraft} if drivkraft else {}

    if drivkraft == "el":
        techical = None
        for _ in range(4):
            extended = result.get("extended")
            if extended is not None:
                techical = extended.get("techical") or {}
                break
            result = _fetch()
        techical = techical or {}

        wltp_el = basic.get("motorElektriskForbrug")
        if pd.isna(wltp_el):
            wltp_el = techical.get("motorElektriskForbrugMaalt")
        car_data["el_faktisk_forbrug"] = wltp_el
        car_data["elektrisk_rækkevidde"] = techical.get(_EL_RANGE_KEY)
    else:
        car_data["kml"] = basic.get("motorKmPerLiter")

    car_data["leasing_end"] = datetime.fromisoformat(raw) if (raw := basic.get("leasingGyldigTil")) else None
    car_data["make"] = basic.get("maerkeTypeNavn")
    car_data["model"] = " ".join(filter(None, [basic.get("modelTypeNavn"), basic.get("variantTypeNavn")])).strip()
    return car_data
