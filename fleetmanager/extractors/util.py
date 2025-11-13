import ast
import asyncio
import json
import urllib.parse

import pandas as pd
import regex as re
import requests
from pyppeteer import launch
from pyppeteer.errors import TimeoutError
from sqlalchemy.orm import Session, selectinload
from tenacity import retry, wait_random_exponential, stop_after_attempt

from fleetmanager.data_access import AllowedStarts
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import calc_distance
import httpx


logger = logging.getLogger(__name__)


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


async def load_content(plate: str) -> str:
    url = f"https://www.tjekbil.dk/nummerplade/{plate}/overblik"

    browser = await launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    )
    page = await browser.newPage()
    logger.info(f"looking for {plate}")
    try:
        await page.goto(url, timeout=60000)
    except TimeoutError:
        logger.info("timeout")
        return ""
    try:
        await page.waitForFunction(
            """
        () => {
            let spans = document.querySelectorAll('.MuiTypography-root.MuiTypography-caption');
            for (let span of spans) {
                if (span.innerText === 'ELEKTRISK FORBRUG' || span.innerText === 'OPGIVET FORBRUG') {
                    return true;
                }
            }
            return false;
        }
        """
        )
    except TimeoutError:
        pass

    content = await page.content()
    await browser.close()

    return content


def get_plate_info(plate: str) -> dict:
    result = asyncio.get_event_loop().run_until_complete(load_content(plate))
    return get_values(result)


@retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(3))
async def load_dmr_request(plate: str):
    url = f"https://www.tjekbil.dk/api/v3/dmr/regnr/{plate}"

    completed = False
    retries = 3
    retry = 0
    while not completed:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url)
                result = response.content.decode()
            except httpx.ReadTimeout as e:
                retry += 1
                if retry < retries:
                    await asyncio.sleep(3 * retry)
                else:
                    raise e

    return json.loads(result)


async def get_plate_info_from_api(plate: str) -> dict:
    result = {}
    task = asyncio.create_task(load_dmr_request(plate))
    done, pending = await asyncio.wait({task}, timeout=60)
    if task in done:
        try:
            result = task.result()
            if "basic" not in result:
                return {}
        except asyncio.InvalidStateError as e:
            logger.info(f"something went wrong {plate}, \n{e}")
            return {}
    for p in pending:
        logger.info(f"timeout for plate {plate}")
        p.cancel()
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
                result = await load_dmr_request(plate)
                retry += 1
                if pd.isna(result.get("extended", {})):
                    continue
                else:
                    result.get("extended", {}).get("techical", {}).get(
                        "elektriskRaekkevidde")  # there's a spelling mistake in response technical = techical
                    break
    else:
        car_data["kml"] = basic.get("motorKmPerLiter")

    car_data["make"] = basic.get("maerkeTypeNavn")
    car_data["model"] = " ".join([basic.get("modelTypeNavn", ""), basic.get("variantTypeNavn", "")]).strip()
    return car_data


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
