from datetime import date, datetime

import pandas as pd
from sqlalchemy import and_, case, not_, or_, select
from sqlalchemy.orm import Session

from fleetmanager.api.configuration.schemas import (
    FuelType,
    LeasingType,
    VehicleType,
)
from fleetmanager.api.simulation_setup.schemas import (
    Location,
    Locations,
    LocationsVehicleList,
    LocationVehicles,
    VehicleView,
)
from fleetmanager.configuration.util import load_name_settings
from fleetmanager.data_access.dbschema import AllowedStarts, Cars, RoundTrips


def get_active_locations(session: Session):
    """util function for endpoint to get all active locations == that has roundtrips and active vehicles"""
    rows = (
        session.query(Cars, AllowedStarts.address, AllowedStarts.id.label("loc_id"))
        .join(AllowedStarts)
        .filter(Cars.omkostning_aar.isnot(None))
    )
    locations = {row.loc_id: row.address for row in rows}
    locations = [{"id": key, "address": value} for key, value in locations.items()]
    return locations


def get_locations(session: Session):
    return Locations(
        locations=[
            Location(id=row.id, address=row.address)
            for row in session.query(AllowedStarts)
        ]
    )


def get_forvaltninger(session: Session):
    """
    returning a map of unique forvaltning to locations
    """
    forvaltning_query = (
        session.query(Cars.forvaltning, Cars.location)
        .where(Cars.location.isnot(None))
        .where(Cars.disabled != True)
        .where(Cars.deleted != True)
        .group_by(Cars.forvaltning, Cars.location)
    )

    grouped = {}
    for forvaltning, location in forvaltning_query:
        key = None if forvaltning in (None, "") else forvaltning
        grouped.setdefault(key, []).append(location)

    if len(grouped) <= 1:
        return {}

    return {
        "Ingen Forvaltning" if name is None else name: locations
        for name, locations in grouped.items()
    }


def get_location_vehicles(
    session: Session,
    start_date: date,
    end_date: date,
    location_id: int | None = None,
) -> LocationsVehicleList | None:
    # todo tilføj alle værdierne der bruges til at finde de "unikke" køretøjer
    start_date = (
        start_date if type(start_date) != str else datetime.fromisoformat(start_date)
    )
    end_date = end_date if type(end_date) != str else datetime.fromisoformat(end_date)
    # lokationer
    location_to_vehicles = LocationsVehicleList(
        locations=[
            LocationVehicles(id=start.id, address=start.address, vehicles=[])
            for start in session.scalars(select(AllowedStarts))
        ]
    )

    # køretøjer der har kørt i den valgte periode
    contributed_cars = (
        select(RoundTrips.car_id)
        .where(RoundTrips.start_time.between(start_date, end_date))
        .where(RoundTrips.end_time.between(start_date, end_date))
        .distinct()
    )

    # uinteressante køretøjer, leasing færdig og ingen rundture
    leasing_ended_cars = (
        select(Cars.id)
        .where(Cars.end_leasing < end_date)
        .where(Cars.id.not_in(contributed_cars))
    )

    # køretøjer med manglende værdier
    data_missing_cars = select(Cars.id).where(
        or_(
            and_(Cars.end_leasing == None, Cars.leasing_type.in_([1, 2])),
            and_(Cars.wltp_el == None, Cars.wltp_fossil == None, Cars.fuel != 10),
            Cars.omkostning_aar == None,
        )
    )

    # Køretøjer med status, notActive, dataMissing, leasingEnded eller ok
    status_query = (
        select(
            Cars,
            case(
                (Cars.id.in_(data_missing_cars), "dataMissing"),
                (
                    and_(
                        select(RoundTrips)
                        .where(RoundTrips.car_id == Cars.id)
                        .where(RoundTrips.start_time.between(start_date, end_date))
                        .where(RoundTrips.end_time.between(start_date, end_date))
                        .exists(),
                        Cars.end_leasing < end_date,
                    ),
                    "leasingEnded",
                ),
                (
                    not_(
                        select(RoundTrips)
                        .where(RoundTrips.car_id == Cars.id)
                        .where(RoundTrips.start_location_id == Cars.location)
                        .where(RoundTrips.start_time.between(start_date, end_date))
                        .where(RoundTrips.end_time.between(start_date, end_date))
                        .exists()
                    ),
                    "notActive",
                ),
                else_="ok",
            ).label("status"),
        )
        .where(Cars.location != None)
        .where(Cars.id.notin_(leasing_ended_cars))
    )

    # Køretøjer med ændring af lokation
    location_changed_query = (
        select(
            RoundTrips.start_location_id.label("oldLocation"),
            Cars,
            case(
                (
                    and_(
                        RoundTrips.start_location_id != Cars.location,
                        RoundTrips.start_location_id != None,
                    ),
                    "locationChanged",
                ),
                else_=None,
            ).label("status"),
        )
        .join(RoundTrips, RoundTrips.car_id == Cars.id)
        .where(RoundTrips.start_time.between(start_date, end_date))
        .where(RoundTrips.end_time.between(start_date, end_date))
        .distinct()
    )

    first = session.execute(status_query).fetchall()
    second = session.execute(location_changed_query).fetchall()
    name_fields = load_name_settings(session)

    # for row in status_query + location_changed_query:
    for row in first + second:
        # python is confused about types in named tuples so we help it a bit
        car: Cars = row.Cars
        if row.status is None:  # case is from locationChanged and not qualified
            continue

        search_location = car.location
        if row.status == "locationChanged":
            search_location = row.oldLocation
        location = next(
            filter(
                lambda loc: loc.id == search_location, location_to_vehicles.locations
            ),
            None,
        )
        if location != None:
            if row.status == "notActive" and (car.disabled or car.deleted):
                # quicker way to check than to include in leasing_ended_cars query
                continue
            if car.disabled or car.deleted:
                continue
            location.vehicles.append(
                VehicleView(
                    name=" ".join(
                        [
                            value
                            for field in name_fields
                            if (value := getattr(car, field))
                        ]
                    ),
                    id=car.id,
                    capacity_decrease=car.capacity_decrease,
                    wltp_fossil=car.wltp_fossil,
                    start_leasing=car.start_leasing,
                    end_leasing=car.end_leasing,
                    omkostning_aar=car.omkostning_aar,
                    wltp_el=car.wltp_el,
                    km_aar=car.km_aar,
                    sleep=car.sleep,
                    plate=car.plate,
                    make=car.make,
                    model=car.model,
                    range=car.range,
                    status=row.status,
                    department=car.department,
                    leasing_type=LeasingType(
                        id=car.leasing_type_obj.id, name=car.leasing_type_obj.name
                    )
                    if car.leasing_type_obj != None
                    else None,
                    fuel=FuelType(id=car.fuel_obj.id, name=car.fuel_obj.name)
                    if car.fuel_obj != None
                    else None,
                    type=VehicleType(id=car.type_obj.id, name=car.type_obj.name)
                    if car.type_obj != None
                    else None,
                    location=Location(
                        id=car.location_obj.id, address=car.location_obj.address
                    )
                    if car.location_obj != None
                    else None,
                    disabled=car.disabled,
                    deleted=car.deleted,
                )
            )
    if location_id:
        return LocationsVehicleList(
            locations=[
                next(
                    filter(
                        lambda loc: loc.id == location_id,
                        location_to_vehicles.locations,
                    ),
                    None,
                )
            ]
        )
    else:
        return location_to_vehicles


def get_location_vehicles_loc(
    session: Session,
    start_date: date,
    end_date: date,
    location_ids: list[int],
    forvaltning: str | None = None,
) -> LocationsVehicleList | None:
    # køretøjer der har kørt i den valgte periode
    contributed_vehicles_query = (
        session.query(RoundTrips.car_id)
    )
    if forvaltning:
        contributed_vehicles_query = contributed_vehicles_query.join(Cars, RoundTrips.car_id == Cars.id).filter(
            Cars.forvaltning == forvaltning if forvaltning != "Ingen Forvaltning" else Cars.forvaltning.is_(None)
        )

    contributed_vehicles = contributed_vehicles_query.filter(
            RoundTrips.start_location_id.in_(location_ids),
            RoundTrips.start_time >= start_date,
            RoundTrips.end_time <= end_date,
        ).distinct()

    other_cars_query = (
        session.query(Cars.id)
        .filter(Cars.id.not_in(contributed_vehicles), Cars.location.in_(location_ids))
    )

    if forvaltning:
        other_cars_query = other_cars_query.filter(
            Cars.forvaltning == forvaltning if forvaltning != "Ingen Forvaltning" else Cars.forvaltning.is_(None)
        )

    # all other cars
    other_cars = [
        id_.id
        for id_ in other_cars_query.distinct().all()
    ]

    contributed_vehicles = [id_.car_id for id_ in contributed_vehicles.all()]
    vehicles = contributed_vehicles + other_cars
    name_fields = load_name_settings(session)
    location = LocationsVehicleList(
        locations=[
            LocationVehicles(
                id=row.id,
                address=row.address,
                vehicles=[
                    VehicleView(
                        name=" ".join(
                            [
                                value
                                for field in name_fields
                                if (value := getattr(car, field))
                            ]
                        ),
                        id=car.id,
                        capacity_decrease=car.capacity_decrease,
                        wltp_fossil=car.wltp_fossil,
                        start_leasing=car.start_leasing,
                        end_leasing=car.end_leasing,
                        omkostning_aar=car.omkostning_aar,
                        wltp_el=car.wltp_el,
                        km_aar=car.km_aar,
                        sleep=car.sleep,
                        plate=car.plate,
                        make=car.make,
                        model=car.model,
                        range=car.range,
                        status=car_status(
                            car,
                            location_ids,
                            end_date,
                            True if car.id in contributed_vehicles else False,
                        ),
                        department=car.department,
                        leasing_type=LeasingType(
                            id=car.leasing_type_obj.id, name=car.leasing_type_obj.name
                        )
                        if car.leasing_type_obj != None
                        else None,
                        fuel=FuelType(id=car.fuel_obj.id, name=car.fuel_obj.name)
                        if car.fuel_obj != None
                        else None,
                        type=VehicleType(id=car.type_obj.id, name=car.type_obj.name)
                        if car.type_obj != None
                        else None,
                        location=Location(
                            id=car.location_obj.id, address=car.location_obj.address
                        )
                        if car.location_obj != None
                        else None,
                        disabled=car.disabled,
                        deleted=car.deleted,
                        description=car.description,
                        forvaltning=car.forvaltning
                    )
                    for car in session.query(Cars).filter(Cars.id.in_(vehicles))
                    if not (car.deleted == True or car.disabled == True)
                ],
            )
            for row in session.query(AllowedStarts).filter(
                AllowedStarts.id.in_(location_ids)
            )
        ]
    )
    return location


def car_status(car, location_id, end_date=None, in_active=True):
    if (car.omkostning_aar is None) or (
        car.wltp_el is None and car.wltp_fossil is None and car.fuel != 10
    ):
        return "dataMissing"
    if car.location not in location_id:
        return "locationChanged"
    if end_date and car.end_leasing is not None and car.end_leasing.date() < end_date:
        return "leasingEnded"
    if in_active is False:
        return "notActive"
    if in_active:
        return "ok"


def get_emission(entry):
    if any(
        [
            (entry.wltp_fossil == 0 and entry.wltp_el == 0),
            (pd.isna(entry.wltp_fossil) and pd.isna(entry.wltp_el)),
        ]
    ):
        return "0"

    udledning = (
        f"{str(round(entry.wltp_el)).replace('.', ',')} Wh/km"
        if pd.isna(entry.wltp_fossil) or entry.wltp_fossil == 0
        else f"{str(round(entry.wltp_fossil, 1)).replace('.', '.')} km/l"
    )
    return udledning
