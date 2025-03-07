import os
from datetime import date, datetime

from sqlalchemy import func, case, or_, and_
from sqlalchemy.orm import Load, Session, selectinload, sessionmaker

from typing import Optional

from fleetmanager.api.location.schemas import (
    AllowedStart,
    AllowedStartAddition,
    AllowedStartPrecision,
    ExtendedLocationInformation,
    PrecisionTestResults,
    PrecisionTestIn
)
from fleetmanager.data_access import AllowedStarts, RoundTrips, engine_creator, Cars
from fleetmanager.data_access import AllowedStartAdditions as AllowedStartAdditionsDB
from fleetmanager.extractors.skyhost.updatedb import location_precision_test as precision_test_skyhost
from fleetmanager.extractors.skyhost.updatedb import location_precision_test_v2 as precision_test_skyhost_v2
from fleetmanager.extractors.mileagebook.updatedb import location_precision_test as precision_test_mileagebook
from fleetmanager.extractors.gamfleet.updatedb import location_precision_test as precision_test_gamfleet
from fleetmanager.extractors.fleetcomplete.updatedb import location_precision_test as precision_test_fleetcomplete
from fleetmanager.extractors.puma.updatedb import location_precision_test as precision_test_puma
from fleetmanager.logging import logging


logger = logging.getLogger(__name__)


def get_allowed_starts(
        session: Session,
        locations: None | list[int] = None
) -> list[AllowedStart]:
    query = session.query(
        AllowedStarts
    ).options(
        selectinload(AllowedStarts.additions),
        selectinload(AllowedStarts.cars).options(
            Load(Cars).load_only(
                Cars.omkostning_aar,
                Cars.wltp_el,
                Cars.wltp_fossil,
                Cars.disabled,
                Cars.deleted
            )
        )
    )

    if locations:
        query = query.filter(AllowedStarts.id.in_(locations))

    allowed_starts = [
        AllowedStart(
            id=start.id,
            address=start.address,
            latitude=start.latitude,
            longitude=start.longitude,
            addition_date=start.addition_date,
            car_count=len(
                [car for car in start.cars if (
                    car.omkostning_aar is not None and
                    (car.wltp_el is not None or car.wltp_fossil is not None) and
                    (car.disabled is not True) and
                    (car.deleted is not True)
                )]
            ),
            additional_starts=[
                AllowedStartAddition(
                    id=addition.id,
                    latitude=addition.latitude,
                    longitude=addition.longitude,
                    allowed_start_id=start.id,
                    addition_date=addition.addition_date
                ) for addition in start.additions
            ]
        )
        for start in query.all()
    ]

    return allowed_starts


def get_location_precision(
        session: Session,
        locations: None | list[int] = None,
        start_date: None | datetime = None,
        end_date: None | datetime = None
) -> list[AllowedStartPrecision]:

    complete_distance_percentage = (
        func.sum(
            case(
                (RoundTrips.aggregation_type == 'complete', RoundTrips.distance),
                else_=0
            )
        ) * 100.0 / func.sum(RoundTrips.distance)
    ).label('complete_distance_percentage')

    query = session.query(
        RoundTrips.start_location_id,
        AllowedStarts.address,
        complete_distance_percentage,
        func.sum(RoundTrips.distance).label('total_distance')
    ).join(
        AllowedStarts, RoundTrips.start_location_id == AllowedStarts.id
    ).filter(
        RoundTrips.aggregation_type != None
    )
    if locations:
        query = query.filter(RoundTrips.start_location_id.in_(locations))
    if start_date:
        query = query.filter(RoundTrips.start_time >= start_date)
    if end_date:
        query = query.filter(RoundTrips.end_time <= end_date)

    query = query.group_by(
        RoundTrips.start_location_id,
        AllowedStarts.address
    ).order_by(
        complete_distance_percentage
    )
    results = [
        AllowedStartPrecision(
            id=start_precision.start_location_id,
            precision=start_precision.complete_distance_percentage,
            roundtrip_km=start_precision.complete_distance_percentage * start_precision.total_distance / 100,
            km=start_precision.total_distance
        ) for start_precision in query.all()
    ]

    return results


def combine_allowed_start_precision(
        allowed_start_list: list[AllowedStart],
        precision_list: list[AllowedStartPrecision]
) -> list[ExtendedLocationInformation]:
    precision_dict = {p.id: p for p in precision_list}

    combined_list: list[ExtendedLocationInformation] = [
        start.to_extended_info(precision_dict.get(start.id))
        for start in allowed_start_list
    ]

    return combined_list


def manage_additions(
        session: Session,
        location: AllowedStarts,
        additions_data: list[AllowedStartAddition],
        existing_additions: Optional[list[AllowedStartAdditionsDB]] = None
):
    existing_additions_dict = {addition.id: addition for addition in existing_additions or []}
    additions_to_keep = set()

    for addition_data in additions_data:
        if addition_data.id and addition_data.id in existing_additions_dict:
            addition = existing_additions_dict[addition_data.id]
            addition.latitude = addition_data.latitude or addition.latitude
            addition.longitude = addition_data.longitude or addition.longitude
            addition.addition_date = addition_data.addition_date or addition.addition_date
            additions_to_keep.add(addition.id)
        else:
            new_addition = AllowedStartAdditionsDB(
                latitude=addition_data.latitude,
                longitude=addition_data.longitude,
                allowed_start=location,
                allowed_start_id=location.id,
                addition_date=addition_data.addition_date or datetime.utcnow()
            )
            session.add(new_addition)

    additions_to_remove = [
        addition for addition in existing_additions_dict.values()
        if addition.id not in additions_to_keep
    ]
    for addition in additions_to_remove:
        session.delete(addition)


def add_new_location(session: Session, location_data: AllowedStart) -> AllowedStart:
    new_location = AllowedStarts(
        address=location_data.address,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        addition_date=location_data.addition_date
    )

    session.add(new_location)
    session.flush()

    manage_additions(
        session=session,
        location=new_location,
        additions_data=location_data.additional_starts or [],
        existing_additions=[]
    )

    session.commit()

    session.refresh(new_location)

    added_additional_starts = [
        AllowedStartAddition(
            id=addition.id,
            latitude=addition.latitude,
            longitude=addition.longitude,
            allowed_start_id=new_location.id,
            addition_date=addition.addition_date
        )
        for addition in new_location.additions
    ]

    return AllowedStart(
        id=new_location.id,
        address=new_location.address,
        latitude=new_location.latitude,
        longitude=new_location.longitude,
        additional_starts=added_additional_starts,
        addition_date=new_location.addition_date,
        car_count=0  # Assuming new location has no cars yet
    )


def update_location_complete(session: Session, location_id: int, update_data: AllowedStart) -> AllowedStart:
    location = session.query(
        AllowedStarts
    ).options(
        selectinload(AllowedStarts.additions),
        selectinload(AllowedStarts.cars).options(
            Load(Cars).load_only(
                Cars.omkostning_aar,
                Cars.wltp_el,
                Cars.wltp_fossil,
                Cars.disabled,
                Cars.deleted
            )
        )
    ).get(location_id)
    if not location:
        raise ValueError(f"Location with ID {location_id} does not exist.")

    location.address = update_data.address or location.address
    location.latitude = update_data.latitude or location.latitude
    location.longitude = update_data.longitude or location.longitude
    location.addition_date = update_data.addition_date or location.addition_date

    manage_additions(session, location, update_data.additional_starts or [], location.additions)

    session.commit()
    session.refresh(location)

    updated_additional_starts = [
        AllowedStartAddition(
            id=addition.id,
            latitude=addition.latitude,
            longitude=addition.longitude,
            allowed_start_id=location.id,
            addition_date=addition.addition_date
        )
        for addition in location.additions
    ]

    return AllowedStart(
        id=location.id,
        address=location.address,
        latitude=location.latitude,
        longitude=location.longitude,
        addition_date=location.addition_date,
        additional_starts=updated_additional_starts,
        car_count=len(
            [car for car in location.cars if (
                car.omkostning_aar is not None and
                (car.wltp_el is not None or car.wltp_fossil is not None) and
                (car.disabled is not True) and
                (car.deleted is not True)
            )]
        )
    )


def precision_test(
        extractors: list[str],
        location: int,
        test_specific_start: AllowedStart,
        start_date: date | datetime,
        task=None,
        test_name=None
):
    test_path = None

    if task is not None and test_name is not None:
        task.update_state(
            state="PROGRESS",
            meta={"progress": 0, "test_name": test_name}
        )
        test_path = f"/fleetmanager/running_tasks/{test_name}.txt"

    extractor_to_test_mapper = {
        "SKYHOST": {"precision_function": precision_test_skyhost, "keys_key": "SKYHOST_KEYS"},
        "MILEAGEBOOK": {"precision_function": precision_test_mileagebook, "keys_key": "MILEAGEBOOK_KEYS"},
        "GAMFLEET": {"precision_function": precision_test_gamfleet, "keys_key": "GAMFLEET_KEYS"},
        "FLEETCOMPLETE": {"precision_function": precision_test_fleetcomplete, "keys_key": "FLEETCOMPLETE_KEYS"},
        "PUMA": {'precision_function': precision_test_puma, "keys_key": "PUMA_KEYS"},  # keys only for continuity
        "SKYHOST_V2": {"precision_function": precision_test_skyhost_v2, "keys_key": "SKYHOST_V2_KEYS"}
    }

    engine = engine_creator()
    session = sessionmaker(bind=engine)()

    cars = session.query(
        Cars.id,
        Cars.location,
        Cars.plate,  # puma extraction is dependent on the plate
        Cars.imei,  # skyhostV2 is dependent on imei as externalid
    ).filter(
        Cars.location == location,
        Cars.omkostning_aar.isnot(None),
        or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
        and_(
            or_(
                Cars.disabled == False, Cars.disabled.is_(None)
            ),
            or_(
                Cars.deleted == False, Cars.deleted.is_(None)
            )
        )
    ).all()

    len_cars = len(cars)
    results = []
    response = PrecisionTestResults(
        test_settings=PrecisionTestIn(
            location=location,
            test_specific_start=test_specific_start,
            start_date=start_date
        ),
        id=location,
        precision=0,
        roundtrip_km=0,
        km=0
    )

    for extractor in extractors:
        if len_cars == len(results):
            # no need to look further if all cars are accounted for
            break
        precision_function = extractor_to_test_mapper.get(extractor, {}).get("precision_function")

        if precision_function is None:
            logger.info(f"Extractor {extractor} does not exist in precision testing")
            continue

        extractor_keys = extractor_to_test_mapper.get(extractor, {}).get("keys_key")
        if extractor_keys is None:
            logger.info(f"Could not find keys key in mapping {extractor}")
            continue

        keys = os.getenv(extractor_keys)
        if keys is None:
            logger.info(f"Could not find keys by {extractor_keys} in env")
            continue

        keys = keys.split(",")

        for k, car_result in enumerate(
                precision_function(
                    session,
                    keys=keys,
                    location=location,
                    cars=cars,
                    test_specific_start=test_specific_start,
                    start_date=start_date
                )
        ):
            results.append(car_result)
            if task is not None and test_path:
                if not os.path.exists(test_path):
                    return response
                task.update_state(
                    state="PROGRESS",
                    meta={"progress": len(results) / len_cars, "test_name": test_name}
                )

    if test_path and os.path.exists(test_path):
        os.remove(test_path)

    response.roundtrip_km = sum(map(lambda car_test: car_test["kilometers"] * car_test["precision"], results))
    response.km = sum(map(lambda car_test: car_test["kilometers"], results))
    response.precision = 0 if response.km == 0 else response.roundtrip_km / response.km
    return response


def update_location_address(session: Session, location_id: int, address: str):
    session.query(AllowedStarts).filter(AllowedStarts.id == location_id).update({"address": address})
    session.commit()
    allowed_start = get_allowed_starts(session, locations=[location_id])
    return [] if not allowed_start else allowed_start[0]
