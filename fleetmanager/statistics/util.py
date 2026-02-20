import datetime
import io
import os
import pickle
import time
from ast import literal_eval
from dataclasses import dataclass
from typing import List, Optional, Tuple
import regex as re

import numpy as np
import pandas as pd
import redis
from dateutil.relativedelta import relativedelta
from pydantic import BaseModel
from sqlalchemy import DATE, BigInteger, and_, cast, distinct, func, literal_column, or_, select, text
from sqlalchemy.orm import Session
from xlsxwriter.utility import xl_range, xl_rowcol_to_cell

from fleetmanager.api.statistics.schemas import (
    LocationActivity,
    LocationUsage,
    StatisticOverview,
    VehicleAvailability,
    WeekLocationActivity,
)
from fleetmanager.configuration.util import load_name_settings
from fleetmanager.data_access import (
    AllowedStarts,
    Cars,
    RoundTrips,
    RoundTripSegments,
    SimulationSettings,
    get_default_fuel_types,
)
from fleetmanager.logging import logging
from fleetmanager.model.tco_calculator import TCOCalculator
from fleetmanager.model.trip_generator import alternate

logger = logging.getLogger(__name__)

dayDelta = datetime.timedelta(days=1)
weekDelta = datetime.timedelta(weeks=1)
monthDelta = relativedelta(months=1)


class ddata(BaseModel):
    roundtrip_id: int
    location_id: int
    aggregation_type: str | None
    distance: int
    shift_id: int | None
    plate: str | None
    vehicle_id: int
    make: str
    model: str | None
    department: str | None
    start_time: datetime.datetime
    end_time: datetime.datetime


carbon_fuels = [1, 2, 4, 5, 6, 9, 11]
drivmidler = {
    1: "benzin",
    2: "diesel",
    3: "el",
    4: "benzin",
    5: "benzin",
    6: "diesel",
    7: "el",
    8: "el",
    9: "benzin",
    11: "hvo"
}


def parse_shifts(session: Session, shifts_input):
    """
    Parse shifts from database or input.

    Args:
        session: Database session
        shifts_input: Either None (load from DB), or a shifts object with .shifts attribute

    Returns:
        List of shift dicts with 'shift_start', 'shift_end', 'break' as datetime.time objects
    """
    if shifts_input is None:
        # Load from database
        shifts_result = (
            session.query(SimulationSettings.value)
            .filter(SimulationSettings.name == "vagt_dashboard")
            .first()
        )
        if shifts_result:
            return [
                {
                    "shift_start": datetime.time(
                        hour=int(slot["shift_start"].split(":")[0]),
                        minute=int(slot["shift_start"].split(":")[-1]),
                    ),
                    "shift_end": datetime.time(
                        hour=int(slot["shift_end"].split(":")[0]),
                        minute=int(slot["shift_end"].split(":")[-1]),
                    ),
                    "break": None
                    if slot.get("break") is None
                    else datetime.time(
                        hour=int(slot["break"].split(":")[0]),
                        minute=int(slot["break"].split(":")[-1]),
                    ),
                }
                for slot in literal_eval(shifts_result[0])
            ]
        else:
            return []
    else:
        # Parse from input object
        return [
            {
                "break" if key == "shift_break" else key: value
                for key, value in shift.dict().items()
            }
            for shift in shifts_input.shifts
        ]


def calculate_shift_id(start_time, end_time, shifts):
    """
    Calculate which shift a trip belongs to based on overlap.

    Args:
        start_time: Trip start time
        end_time: Trip end time
        shifts: List of shift dicts with 'shift_start' and 'shift_end'

    Returns:
        Index of the shift with maximum overlap, or None if no shifts
    """
    if not shifts:
        return None
    return np.argmax(
        [
            alternate(
                {"start_time": start_time, "end_time": end_time},
                ssh=shift["shift_start"],
                seh=shift["shift_end"],
            )
            for shift in shifts
        ]
    )


def get_summed_statistics(
    session: Session,
    start_date: datetime.date = None,
    end_date: datetime.date = None,
    locations: list[int] = None,
    forvaltninger: list[str] = None,
) -> StatisticOverview:
    s = time.time()
    roundtrip_query = session.query(
        func.sum(RoundTrips.distance).label("total"),
        RoundTrips.car_id,
    ).filter(RoundTrips.car_id.isnot(None))
    roundtrip_segment_query = (
        session.query(
            func.sum(RoundTripSegments.distance).label("total"),
            RoundTrips.car_id,
        )
        .join(RoundTrips, RoundTrips.id == RoundTripSegments.round_trip_id)
        .filter(RoundTrips.car_id.isnot(None))
    )

    if start_date and end_date:
        roundtrip_query = roundtrip_query.filter(
            RoundTrips.start_time >= start_date,
            RoundTrips.start_time <= end_date + datetime.timedelta(days=1),
        )
        roundtrip_segment_query = roundtrip_segment_query.filter(
            RoundTripSegments.start_time >= start_date,
            RoundTripSegments.start_time <= end_date + datetime.timedelta(days=1),
        )

    if locations:
        roundtrip_segment_query = roundtrip_segment_query.filter(
            RoundTrips.start_location_id.in_(locations)
        )

    roundtrip_segment_query = roundtrip_segment_query.group_by(RoundTrips.car_id)

    if forvaltninger:
        if "Ingen Forvaltning" in forvaltninger:
            all_vehicles = {car.id: car for car in session.query(Cars).filter(
                or_(
                    Cars.forvaltning.in_(forvaltninger),
                    Cars.forvaltning.is_(None)
                )
            )}
        else:
            all_vehicles = {car.id: car for car in session.query(
                Cars).filter(Cars.forvaltning.in_(forvaltninger))}
    else:
        all_vehicles = {car.id: car for car in session.query(Cars)}

    total_roundtrips = (session.query(func.count(RoundTrips.id)).first())[0]

    fuel = {
        value.name: float(value.value)
        for value in session.query(SimulationSettings).filter(
            or_(
                SimulationSettings.name == "el_udledning",
                SimulationSettings.name == "benzin_udledning",
                SimulationSettings.name == "diesel_udledning",
                SimulationSettings.name == "hvo_udledning"
            )
        )
    }
    fuel_to_actual_fuel = {
        fuel_type.id: fuel_type.refers_to for fuel_type in get_default_fuel_types()
    }
    total_driven = 0
    total_udledning = 0
    nonfossil_usage = 0
    for entry in roundtrip_segment_query:
        if entry.car_id not in all_vehicles:
            continue
        car = all_vehicles[entry.car_id]
        total_driven += entry.total
        if car.fuel is None or fuel_to_actual_fuel[car.fuel] not in [1, 2]:
            nonfossil_usage += entry.total
        if car.fuel is None or car.fuel == 10:
            continue
        drivmiddel = drivmidler[car.fuel]
        wltp_el = 0 if car.wltp_el is None else car.wltp_el
        wltp_fossil = 0 if car.wltp_fossil is None else car.wltp_fossil
        vehicle_tco = TCOCalculator(
            koerselsforbrug=entry.total,
            drivmiddel=drivmiddel,
            bil_type=drivmiddel,
            antal=1,
            evalueringsperiode=1,
            fremskrivnings_aar=0,
            braendstofforbrug=0 if pd.isna(wltp_fossil) else wltp_fossil,
            elforbrug=0 if pd.isna(wltp_el) else wltp_el,
            **fuel,
        )
        co2e, samfund = vehicle_tco.ekstern_miljoevirkning(sum_it=True)
        total_udledning += co2e

    if start_date and end_date:
        first_date = start_date
        last_date = end_date
    else:
        first_date, last_date = session.query(
            func.min(RoundTrips.start_time), func.max(RoundTrips.end_time)
        ).first()

    return StatisticOverview(
        first_date=first_date,
        last_date=last_date,
        total_emission=total_udledning,
        total_driven=round(total_driven),
        share_carbon_neutral=0 if total_driven == 0 else round(
            (nonfossil_usage / total_driven) * 100),
        total_roundtrips=total_roundtrips,
    )


def carbon_neutral_share(
    session: Session,
    start_date: datetime.datetime,
    end_date: datetime.datetime,
    locations: list[int] | None = None,
    forvaltninger: list[str] | None = None
):
    roundtrip_segment_query = (
        session.query(
            func.sum(RoundTripSegments.distance).label("total"),
            cast(RoundTripSegments.start_time, DATE).label("date")
            if "mssql" in session.bind.engine.dialect.name
            else func.date(RoundTripSegments.start_time).label("date"),
            RoundTrips.car_id.label("rtcid"),
        )
        .join(RoundTrips, RoundTrips.id == RoundTripSegments.round_trip_id)
        .filter(
            RoundTrips.car_id.isnot(None),
            RoundTripSegments.start_time >= start_date,
            RoundTripSegments.start_time <= end_date,
        )
    )
    if locations:
        roundtrip_segment_query = roundtrip_segment_query.filter(
            RoundTrips.start_location_id.in_(locations)
        )

    roundtrip_segment_query = roundtrip_segment_query.group_by(
        RoundTrips.car_id,
        cast(RoundTripSegments.start_time, DATE)
        if "mssql" in session.bind.engine.dialect.name
        else func.date(RoundTripSegments.start_time),
    ).subquery()

    join_ = session.query(
        Cars.fuel,
        func.sum(roundtrip_segment_query.c.total).label("total"),
        roundtrip_segment_query.c.date
    ).filter(Cars.wltp_el.isnot(None) | Cars.wltp_fossil.isnot(None))

    if forvaltninger:
        if "Ingen Forvaltning" in forvaltninger:
            join_ = join_.filter(
                or_(Cars.forvaltning.is_(None), Cars.forvaltning.in_(forvaltninger)))
        else:
            join_ = join_.filter(Cars.forvaltning.in_(forvaltninger))
    join_query = join_.join(Cars, roundtrip_segment_query.c.rtcid == Cars.id).group_by(Cars.fuel, roundtrip_segment_query.c.date)

    frame = pd.DataFrame(join_query.all())
    dates = []
    shares = []
    if len(frame) > 0:
        r = pd.date_range(start=frame.date.min(), end=frame.date.max())
        all_dates = pd.DataFrame({"date": r})
        fossil = frame[frame.fuel.isin(carbon_fuels)]
        fossil = fossil.groupby(["date"])["total"].sum().reset_index()
        fossil["date"] = pd.to_datetime(fossil["date"])
        fossil = pd.merge(all_dates, fossil, on="date", how="left").fillna(0)
        notfossil = frame[~frame.fuel.isin(carbon_fuels)]
        notfossil = notfossil.groupby(["date"])["total"].sum().reset_index()
        notfossil["date"] = pd.to_datetime(notfossil["date"])
        notfossil = pd.merge(all_dates, notfossil, on="date", how="left").fillna(0)
        dates = notfossil.date.tolist()
        shares = ((notfossil.total / (fossil.total + notfossil.total)) * 100).tolist()

    return {"x": dates, "y": shares}


def emission_series(
    session: Session,
    start_date: datetime.datetime,
    end_date: datetime.datetime,
    locations: list[int] | None = None,
    forvaltninger: list[str] | None = None
):
    roundtrip_segment_query = (
        session.query(
            func.sum(RoundTripSegments.distance).label("total"),
            cast(RoundTripSegments.start_time, DATE).label("date")
            if "mssql" in session.bind.engine.dialect.name
            else func.date(RoundTripSegments.start_time).label("date"),
            RoundTrips.car_id.label("rtcid"),
        )
        .join(RoundTrips, RoundTrips.id == RoundTripSegments.round_trip_id)
        .filter(
            RoundTrips.car_id.isnot(None),
            RoundTripSegments.start_time >= start_date,
            RoundTripSegments.start_time <= end_date,
        )
    )
    if locations:
        roundtrip_segment_query = roundtrip_segment_query.filter(
            RoundTrips.start_location_id.in_(locations)
        )

    roundtrip_segment_query = roundtrip_segment_query.group_by(
        RoundTrips.car_id,
        cast(RoundTripSegments.start_time, DATE)
        if "mssql" in session.bind.engine.dialect.name
        else func.date(RoundTripSegments.start_time),
    )

    frame = pd.DataFrame(roundtrip_segment_query.all())
    x = []
    y = []
    if len(frame) > 0:
        veh_query = session.query(Cars)

        if forvaltninger:
            if "Ingen Forvaltning" in forvaltninger:
                veh_query = veh_query.filter(
                    or_(Cars.forvaltning.is_(None), Cars.forvaltning.in_(forvaltninger)))
            else:
                veh_query = veh_query.filter(Cars.forvaltning.in_(forvaltninger))

        veh_query = veh_query.filter(or_(Cars.wltp_el.isnot(None), Cars.wltp_fossil.isnot(None)),
                                     Cars.omkostning_aar.isnot(None),
                                     Cars.fuel.isnot(None))
        all_vehicles = {
            vehicle.id: vehicle
            for vehicle in veh_query
        }

        frame["car"] = frame.rtcid.apply(lambda car_id: all_vehicles.get(car_id))
        frame.dropna(subset=["car"], inplace=True)
        fuel = {
            value.name: float(value.value)
            for value in session.query(SimulationSettings).filter(
                or_(
                    SimulationSettings.name == "el_udledning",
                    SimulationSettings.name == "benzin_udledning",
                    SimulationSettings.name == "diesel_udledning",
                    SimulationSettings.name == "hvo_udledning"
                )
            )
        }

        def calc_tco(row):
            if row.car.fuel == 10:
                return 0
            vehicle_tco = TCOCalculator(
                koerselsforbrug=row.total,
                drivmiddel=drivmidler[row.car.fuel],
                bil_type=drivmidler[row.car.fuel],
                antal=1,
                evalueringsperiode=1,
                fremskrivnings_aar=0,
                braendstofforbrug=0
                if pd.isna(row.car.wltp_fossil)
                else row.car.wltp_fossil,
                elforbrug=0 if pd.isna(row.car.wltp_el) else row.car.wltp_el,
                **fuel,
            )
            return vehicle_tco.ekstern_miljoevirkning(sum_it=True)[0]

        frame["udledning"] = frame.apply(calc_tco, axis=1)
        frame = frame.groupby("date")["udledning"].sum().reset_index()
        r = pd.date_range(start=frame.date.min(), end=frame.date.max())
        all_dates = pd.DataFrame({"date": r})
        frame["date"] = pd.to_datetime(frame["date"])
        frame = pd.merge(all_dates, frame, on="date", how="left").fillna(0)
        x = frame.date.tolist()
        y = frame.udledning.tolist()

    return {"x": x, "y": y}


def total_driven(
    session: Session,
    start_date: datetime.datetime,
    end_date: datetime.datetime,
    locations: list[int] | None = None,
    forvaltninger: list[str] | None = None,
):
    roundtrip_segment_query = (
        session.query(
            func.sum(RoundTripSegments.distance).label("total"),
            cast(RoundTripSegments.start_time, DATE).label("date")
            if "mssql" in session.bind.engine.dialect.name
            else func.date(RoundTripSegments.start_time).label("date"),
        )
        .join(RoundTrips, RoundTrips.id == RoundTripSegments.round_trip_id)
        .filter(
            RoundTripSegments.start_time >= start_date,
            RoundTripSegments.start_time <= end_date,
        )
    )

    if forvaltninger:
        if "Ingen Forvaltning" in forvaltninger:
            roundtrip_segment_query = roundtrip_segment_query.join(Cars, RoundTrips.car_id == Cars.id).filter(
                or_(Cars.forvaltning.is_(None), Cars.forvaltning.in_(forvaltninger))
            )
        else:
            roundtrip_segment_query = roundtrip_segment_query.join(Cars, RoundTrips.car_id == Cars.id).filter(
                Cars.forvaltning.in_(forvaltninger)
            )

    if locations:
        roundtrip_segment_query = roundtrip_segment_query.filter(
            RoundTrips.start_location_id.in_(locations)
        )

    roundtrip_segment_query = roundtrip_segment_query.group_by(
        cast(RoundTripSegments.start_time, DATE).label("date")
        if "mssql" in session.bind.engine.dialect.name
        else func.date(RoundTripSegments.start_time).label("date"),
    )
    roundtrip_segment_frame = pd.DataFrame(roundtrip_segment_query.all())

    round_trips_frame = pd.DataFrame()
    x = []
    y = []
    if len(round_trips_frame) > 0 or len(roundtrip_segment_frame) > 0:
        combined_frame = pd.concat([roundtrip_segment_frame, round_trips_frame])
        combined_frame["date"] = pd.to_datetime(combined_frame["date"])
        combined_frame = combined_frame.groupby("date").sum().reset_index()

        r = pd.date_range(
            start=combined_frame.date.min(), end=combined_frame.date.max()
        )
        all_dates = pd.DataFrame({"date": r})
        result_frame = pd.merge(
            all_dates, combined_frame, on="date", how="left"
        ).fillna(0)

        x = result_frame.date.tolist()
        y = result_frame.total.tolist()

    return {"x": x, "y": y}


def daily_driving(
    session: Session,
    start_date: datetime.date,
    end_date: datetime.date,
    locations: (list[int] | None) = None,
    vehicles: (list[int] | None) = None,
    shifts: (list[str] | None) = None,
    departments: (list[str | None] | None) = None,
    include_trip_segments: bool | None = False,
    as_segments: bool | None = False,
):
    # todo shifts should not be done in driving activity
    # todo rethink the shifts, we don't need to do this heavy processing for showing the shift id
    shifts = parse_shifts(session, shifts)
    # avoid using functions or calculations on indexed columns in where clause
    # use direct comparison where possible, due not wrap columns in a function
    # if function is needed, create a computed column or a function based index if the db supports it
    if as_segments:
        query = (
            session.query(
                RoundTrips.id,
                RoundTrips.car_id,
                func.coalesce(
                    RoundTripSegments.start_time, RoundTrips.start_time
                ).label("start_time"),
                func.coalesce(RoundTripSegments.end_time, RoundTrips.end_time).label(
                    "end_time"
                ),
                RoundTrips.start_latitude,
                RoundTrips.start_longitude,
                RoundTrips.end_latitude,
                RoundTrips.end_longitude,
                RoundTrips.start_location_id,
                func.coalesce(RoundTripSegments.distance, RoundTrips.distance).label(
                    "distance"
                ),
                func.coalesce(RoundTrips.aggregation_type, None).label(
                    "aggregation_type"
                ),
                Cars.plate,
                Cars.make,
                Cars.model,
                Cars.department,
            )
            .join(Cars, Cars.id == RoundTrips.car_id)
            .outerjoin(
                RoundTripSegments, RoundTripSegments.round_trip_id == RoundTrips.id
            )
            .filter(
                RoundTrips.car_id.isnot(None),
                RoundTrips.start_time >= start_date,
                RoundTrips.end_time <= end_date,
                Cars.omkostning_aar.isnot(None),
                (Cars.wltp_el.isnot(None) | Cars.wltp_fossil.isnot(None)),
            )
        )
    else:
        # Using explicit select instead of whole model, which is more efficient
        query = (
            session.query(
                RoundTrips.id,
                RoundTrips.car_id,
                RoundTrips.start_time,
                RoundTrips.end_time,
                RoundTrips.start_latitude,
                RoundTrips.start_longitude,
                RoundTrips.end_latitude,
                RoundTrips.end_longitude,
                RoundTrips.start_location_id,
                RoundTrips.distance,
                func.coalesce(RoundTrips.aggregation_type, None).label(
                    "aggregation_type"
                ),
                Cars.plate,
                Cars.make,
                Cars.model,
                Cars.department,
            )
            .join(Cars, Cars.id == RoundTrips.car_id)
            .filter(
                RoundTrips.car_id.isnot(None),
                RoundTrips.start_time >= start_date,
                RoundTrips.end_time <= end_date,
                Cars.omkostning_aar.isnot(None),
                (Cars.wltp_el.isnot(None) | Cars.wltp_fossil.isnot(None)),
            )
        )

    if locations is not None:
        query = query.filter(RoundTrips.start_location_id.in_(locations))
    if vehicles is not None:
        query = query.filter(RoundTrips.car_id.in_(vehicles))

    if departments is not None:
        if None in departments:
            departments_without_none = list(
                filter(lambda dep: dep is not None, departments)
            )
            query = query.filter(
                or_(
                    Cars.department.in_(departments_without_none),
                    Cars.department.is_(None),
                )
            )
        else:
            query = query.filter(Cars.department.in_(departments))

    cols = [
        "id",
        "car_id",
        "start_time",
        "end_time",
        "start_latitude",
        "start_longitude",
        "end_latitude",
        "end_longitude",
        "start_location_id",
        "distance",
        "aggregation_type",
        "plate",
        "make",
        "model",
        "department",
    ]
    s = time.time()
    # get and sort the queried columns
    f = [
        [
            getattr(row, col)
            if "." not in col
            else getattr(
                getattr(row, col.split(".")[0]), col.split(".")[1]
            )  # used if we access relationship attr e.g. roundtrips.car.plate,
            # bear in mind it's super slow querying like this
            for col in cols
        ]
        for row in query
    ]
    rt = pd.DataFrame(f, columns=cols)

    # only pull the trip_segments if requested
    if include_trip_segments and as_segments is False:
        s = time.time()
        # all the roundtrip ids for the one to many relationship to roundtrip segments
        roundtrip_ids = [roundtrip.id for roundtrip in query]
        roundtrip_segments_dict = {}
        # specific chunk size for multiple queries due to SQL placeholder limitations, i.e. "._in(roundtrip ids)
        chunk_size = 200
        for i in range(0, len(roundtrip_ids), chunk_size):
            chunk_ids = roundtrip_ids[i: i + chunk_size]
            roundtrip_segment_query = session.query(RoundTripSegments).filter(
                RoundTripSegments.round_trip_id.in_(chunk_ids)
            )
            for roundtrip_segment in roundtrip_segment_query:
                rt_id = roundtrip_segment.round_trip_id
                if rt_id not in roundtrip_segments_dict:
                    roundtrip_segments_dict[rt_id] = []
                roundtrip_segments_dict[rt_id].append(roundtrip_segment)
        rt["trip_segments"] = rt.id.apply(
            lambda x: []
            if x not in roundtrip_segments_dict
            else roundtrip_segments_dict[x]
        )

    response = {
        "query_start_date": start_date,
        "query_end_date": end_date,
        "query_locations": [],
        "query_vehicles": [],
        "shifts": shifts,
        "driving_data": rt.to_dict("records"),
    }

    if len(rt) == 0:
        return response

    if len(shifts) > 0:
        s = time.time()
        rt["shift_id"] = rt.apply(
            lambda row: np.argmax(
                list(
                    map(
                        lambda shift: alternate(
                            row, ssh=shift["shift_start"], seh=shift["shift_end"]
                        ),
                        shifts,
                    )
                )
            ),
            axis=1,
        )

    else:
        rt["shift_id"] = 0
    rt.rename(
        {
            "car_id": "vehicle_id",
            "start_location_id": "location_id",
            "id": "roundtrip_id",
        },
        axis=1,
        inplace=True,
    )

    rt["location_id"] = rt.location_id.apply(lambda x: 0 if pd.isna(x) else x)
    vehicle_query = select(Cars).where(
        or_(
            Cars.id.in_(rt.vehicle_id.unique().astype(str)),
            Cars.location.in_([] if locations is None else locations),
            Cars.id.in_([] if vehicles is None else vehicles),
        )
    )
    name_fields = load_name_settings(session)
    query_vehicles = [
        {
            "id": row.id,
            "name": " ".join(
                [
                    value
                    for field in name_fields
                    if (value := getattr(row, field))
                ]
            ),
            "location_id": row.location,
            "plate": row.plate,
        }
        for row in session.scalars(vehicle_query)
    ]

    query_locations = [
        {"id": location.id, "address": location.address}
        for location in session.query(AllowedStarts).where(
            AllowedStarts.id.in_(
                list(map(lambda x: str(int(x)), rt.location_id.unique()))
            )
        )
    ]

    response = {
        "query_start_date": start_date,
        "query_end_date": end_date,
        "query_locations": query_locations,
        "query_vehicles": query_vehicles,
        "shifts": shifts,
        "driving_data": rt.to_dict("records"),
    }

    return response


def driving_data_to_excel(data, threshold):
    output = io.BytesIO()
    writer = pd.ExcelWriter(output, engine="xlsxwriter")
    workbook = writer.book
    worksheet = workbook.add_worksheet()

    df = pd.DataFrame(data["driving_data"])
    df["date"] = df.end_time.apply(lambda x: x.date()).astype(
        str
    )  # Convert date column to string
    new_df = df[["shift_id", "date", "plate", "distance", "location_id"]]

    # Step 1: Find the complete list of unique plates and dates
    all_plates = new_df["plate"].unique()
    all_dates = sorted(new_df["date"].unique())

    # Step 2-5
    shift_ids = new_df["shift_id"].astype(int)  # Convert shift_id values to integers
    shift_ranges = {}
    if len(shift_ids.unique()) == 1:
        shift_ranges[0] = f"00:00-23:59"
    else:
        for shift_id in shift_ids:
            shift_dict = data["shifts"][shift_id]
            shift_start = shift_dict["shift_start"]
            shift_end = shift_dict["shift_end"]
            shift_start_str = shift_start.strftime("%H:%M")
            shift_end_str = shift_end.strftime("%H:%M")
            shift_range = f"{shift_start_str}-{shift_end_str}"
            shift_ranges[shift_id] = shift_range

    # Get unique shift_id values
    unique_shift_ids = new_df["shift_id"].unique()

    # Set the initial row and column values
    start_row = 0
    start_col = 0

    query_vehicles = pd.DataFrame(data["query_vehicles"])

    format_table = workbook.add_format(
        {"bg_color": "#FFC7CE"}
    )  # Set the background color for cells inside the table
    for loc in data["query_locations"]:
        for shift_id in unique_shift_ids:
            # Filter based on shift_id and date
            location_filtered = new_df[(new_df["location_id"] == loc["id"])]
            filtered_df = location_filtered[(location_filtered["shift_id"] == shift_id)]
            # Groupby and calculate sum of distances
            summed_df = (
                filtered_df.groupby(["plate", "date"])["distance"]
                .sum()
                .apply(lambda x: round(x, 1))
                .reset_index()
            )

            vehicles_at_location = query_vehicles[
                (query_vehicles["location_id"] == loc["id"])
            ]

            # Step 2: Create an empty table with all plates and dates
            empty_table = pd.DataFrame(
                index=vehicles_at_location["plate"].unique(), columns=all_dates
            )
            empty_table = empty_table.fillna(0)  # Fill empty cells with 0

            # Step 3: Update the empty table with distance values from the filtered DataFrame
            empty_table.update(
                summed_df.pivot(index="plate", columns=["date"], values="distance")
            )

            # Step 4: Add "Nummerplader" as the first column in each table
            empty_table.insert(0, "Nummerplader", empty_table.index)

            # Create the DataFrame
            table_range = (
                start_row,
                start_col,
                start_row + len(empty_table) + 1,
                start_col + len(empty_table.columns),
            )  # Adjusted the last_col value
            column_names = list(empty_table.columns)

            # Write the heading title
            sheet_name = (
                f"Vagtlag: kl. {shift_ranges[int(shift_id)]} - {loc['address'].strip()}"
            )
            heading_format = workbook.add_format(
                {"bold": True, "font_size": 14}
            )  # Create a format for the heading
            worksheet.merge_range(
                start_row,
                start_col,
                start_row,
                start_col + len(column_names) - 1,
                sheet_name,
                heading_format,
            )

            # Write the column names and autofit columns
            for col_num, column_name in enumerate(column_names):
                worksheet.write(
                    start_row + 1, start_col + col_num, column_name, format_table
                )
                column_width = len(column_name) + 2  # Add some padding
                worksheet.set_column(
                    start_col + col_num, start_col + col_num, column_width
                )  # Set column width based on column name
            worksheet.set_row(
                start_row, None, None, {"level": 1}
            )  # Set the row height for the merged cells

            # Write the data rows
            for row_num, (_, row) in enumerate(empty_table.iterrows(), start_row + 2):
                for col_num, value in enumerate(row, start_col):
                    worksheet.write(row_num, col_num, value)

            # Add a table
            last_row = len(empty_table) + start_row + 1
            last_col = (
                len(empty_table.columns) + start_col - 1
            )  # Adjusted the last_col value
            table_range = (start_row + 1, start_col, last_row, last_col)
            column_names = list(empty_table.columns)
            format_table = workbook.add_format(
                {"bg_color": "#FFC7CE"}
            )  # Set the background color for cells inside the table
            worksheet.add_table(
                *table_range,
                {
                    "header_row": True,
                    "style": "Table Style Medium 2",
                    "columns": [
                        {"header": name, "format": format_table}
                        for name in column_names
                    ],
                },
            )

            # Add conditional format to highlight empty cells inside the table
            empty_format = workbook.add_format({"bg_color": "#FF0000"})
            for row_num in range(start_row + 2, last_row + 1):
                for col_num in range(start_col, last_col + 1):
                    cell_address = xl_rowcol_to_cell(row_num, col_num)
                    formula = f"ISBLANK({cell_address})"
                    worksheet.conditional_format(
                        cell_address,
                        {
                            "type": "formula",
                            "criteria": formula,
                            "format": empty_format,
                        },
                    )

            # The threshold for when the cells turns white
            color_threshold = threshold

            # Add 3-step color scale for the distance values
            data_range = xl_range(start_row + 2, start_col + 1, last_row, last_col)
            color_scale_format = workbook.add_format()
            color_scale_format.set_num_format(
                50
            )  # Set the number format to be used for the color scale

            # Add conditional format for values below the threshold
            threshold_format = workbook.add_format(
                {"bg_color": "#FFFFFF"}
            )  # White color for cells above threshold
            worksheet.conditional_format(
                data_range,
                {
                    "type": "cell",
                    "criteria": ">",
                    "value": color_threshold,
                    "format": threshold_format,
                },
            )

            # Add 3-step color scale for values below the threshold
            worksheet.conditional_format(
                data_range,
                {
                    "type": "3_color_scale",
                    "format": color_scale_format,
                    "min_color": "#FF0000",
                    "mid_color": "#FF6D79",
                    "max_color": "#FFC7CE",
                },
            )
            start_row = last_row + 3

    writer.close()
    output.seek(0)
    return output


def get_daily_driving_data(
    session: Session,
    start_date,
    end_date,
    locations: (list[int] | None) = None,
    vehicles: (list[int] | None) = None,
    shifts: (list[dict] | None) = None,
    departments: (list[str | None] | None) = None,
    forvaltninger: (list[str | None] | None) = None,
    include_trip_segments: bool | None = False,
    as_segments: bool | None = False,
):
    """
    Retrieve daily driving data for dashboards with optional segment granularity.

    Filters data to "eligible" vehicles only (non-disabled, non-deleted, with valid
    cost and fuel consumption data).

    Modes:
        - Default (both False): Returns plain roundtrips
        - include_trip_segments=True: Returns roundtrips with embedded 'trip_segments' array
        - as_segments=True: Returns flat segment records for granular time allocation

        Note: include_trip_segments takes precedence over as_segments for backward
        compatibility. If both are True, embedded segments mode is used.

    When as_segments=True:
        Each segment record includes 'roundtrip_start_time' and 'roundtrip_end_time'
        from the parent roundtrip. This allows tracking "in use but not driving" periods
        (e.g., when a vehicle is parked at a destination between segments).

    Args:
        session: Database session
        start_date: Start of date range
        end_date: End of date range
        locations: Filter by location IDs
        vehicles: Filter by vehicle IDs
        shifts: Shift configuration (loaded from DB if None)
        departments: Filter by department names
        forvaltninger: Filter by forvaltning names
        include_trip_segments: Include embedded trip_segments array in roundtrips
        as_segments: Return flat segment records instead of roundtrips

    Returns:
        dict with keys:
            - query_start_date, query_end_date: Date range
            - query_locations: List of location dicts
            - query_vehicles: List of vehicle dicts
            - shifts: Parsed shift configuration
            - driving_data: List of roundtrip/segment records
    """

    try:
        shifts = parse_shifts(session, shifts)

        vehicles_query = session.query(Cars.id).filter(
            Cars.omkostning_aar.isnot(None),
            (Cars.wltp_el.isnot(None) | Cars.wltp_fossil.isnot(None)),
            Cars.location.isnot(None),
            and_(
                or_(Cars.disabled.is_(None), Cars.disabled == False),
                or_(Cars.deleted.is_(None), Cars.deleted == False))
        )
        if departments:
            vehicles_query = vehicles_query.filter(Cars.department.in_(departments))
        if vehicles:
            vehicles_query = vehicles_query.filter(Cars.id.in_(vehicles))
        else:
            vehicles = []
        if forvaltninger:
            if "Ingen Forvaltning" in forvaltninger:
                vehicles_query = vehicles_query.filter(
                    or_(Cars.forvaltning.is_(None), Cars.forvaltning.in_(forvaltninger))
                )
            else:
                vehicles_query = vehicles_query.filter(
                    Cars.forvaltning.in_(forvaltninger))

        vehicles_query_join = vehicles_query.subquery()

        roundtrips = (
            session.query(
                RoundTrips.id,
                RoundTrips.car_id,
                RoundTrips.start_time,
                RoundTrips.end_time,
                RoundTrips.distance,
                RoundTrips.start_location_id,
                RoundTrips.aggregation_type,
            )
            .join(vehicles_query_join)
            .filter(
                RoundTrips.start_time >= start_date,
                RoundTrips.end_time <= end_date,
            )
        )
        if locations:
            roundtrips = roundtrips.filter(RoundTrips.start_location_id.in_(locations))
            vehicles_query = vehicles_query.filter(Cars.location.in_(locations))

        query = roundtrips

        # include_trip_segments takes precedence over as_segments for backward compatibility
        if include_trip_segments:
            sub = query.subquery()
            query = session.query(
                sub.c.id,
                sub.c.car_id,
                sub.c.start_time,
                sub.c.end_time,
                sub.c.start_location_id,
                sub.c.aggregation_type,
                sub.c.distance,
                RoundTripSegments,
            ).join(RoundTripSegments)
        elif as_segments:
            sub = roundtrips.subquery()
            query = session.query(
                RoundTripSegments.id,
                sub.c.car_id,
                sub.c.start_location_id,
                RoundTripSegments.distance,
                RoundTripSegments.start_time,
                RoundTripSegments.end_time,
                sub.c.id.label("roundtrip_id"),
                sub.c.start_time.label("roundtrip_start_time"),
                sub.c.end_time.label("roundtrip_end_time"),
            ).join(sub, sub.c.id == RoundTripSegments.round_trip_id)

        alls = query.all()

        name_fields = load_name_settings(session)
        query_vehicles = {
            row.id: {
                "id": row.id,
                "name": " ".join(
                    [
                        value
                        for field in name_fields
                        if (value := getattr(row, field))
                    ]
                ),
                "location_id": row.location,
                "plate": row.plate,
                "department": row.department,
                "make": row.make,
                "model": row.model,
            }
            for row in session.query(Cars)
            .filter(Cars.id.in_(
                list(set(map(lambda res: res.car_id, alls))) + vehicles + [car.id for car in vehicles_query.all()])
            )
            .all()
        }

        if include_trip_segments:
            roundtrip_data = {}
            visited = set()
            for rt in alls:
                if rt.id not in visited:
                    visited.add(rt.id)
                    roundtrip_data[rt.id] = {
                        "roundtrip_id": rt.id,
                        "start_time": rt.start_time,
                        "end_time": rt.end_time,
                        "trip_segments": [],
                        "distance": rt.distance,
                        "location_id": rt.start_location_id,
                        "aggregation_type": rt.aggregation_type,
                        "shift_id": calculate_shift_id(rt.start_time, rt.end_time, shifts),
                        "plate": query_vehicles[rt.car_id]["plate"],
                        "vehicle_id": rt.car_id,
                        "make": query_vehicles[rt.car_id]["make"],
                        "model": query_vehicles[rt.car_id]["model"],
                        "department": query_vehicles[rt.car_id]["department"],
                    }
                roundtrip_data[rt.id]["trip_segments"].append(
                    {
                        "start_time": rt.RoundTripSegments.start_time,
                        "end_time": rt.RoundTripSegments.end_time,
                        "distance": rt.RoundTripSegments.distance,
                    }
                )
            roundtrip_data = list(roundtrip_data.values())
        else:
            roundtrip_data = []
            for rt in alls:
                record = {
                    "roundtrip_id": rt.roundtrip_id if as_segments else rt.id,
                    "location_id": rt.start_location_id,
                    "aggregation_type": None,
                    "distance": rt.distance,
                    "start_time": rt.start_time,
                    "end_time": rt.end_time,
                    "trip_segments": [],
                    "shift_id": calculate_shift_id(rt.start_time, rt.end_time, shifts),
                    "plate": query_vehicles[rt.car_id]["plate"],
                    "vehicle_id": rt.car_id,
                    "make": query_vehicles[rt.car_id]["make"],
                    "model": query_vehicles[rt.car_id]["model"],
                    "department": query_vehicles[rt.car_id]["department"],
                }
                # add roundtrip boundaries when working with segments to allow marking "non-driving active periods"
                if as_segments:
                    record["roundtrip_start_time"] = rt.roundtrip_start_time
                    record["roundtrip_end_time"] = rt.roundtrip_end_time
                roundtrip_data.append(record)
        query_locations = [
            {"id": location.id, "address": location.address}
            for location in session.query(AllowedStarts)
        ]
        if locations:
            query_locations = list(
                filter(lambda loc: loc["id"] in locations, query_locations)
            )
        elif vehicles:
            vehicle_locations = list(
                map(lambda vehicle: vehicle["location_id"], query_vehicles.values())
            ) + list(set([a.get("location_id") for a in roundtrip_data]))
            query_locations = list(
                filter(lambda loc: loc["id"] in vehicle_locations, query_locations)
            )

        response = {
            "query_start_date": start_date,
            "query_end_date": end_date,
            "query_locations": query_locations,
            "query_vehicles": list(query_vehicles.values()),
            "shifts": shifts,
            "driving_data": roundtrip_data,
        }
    except Exception as e:
        alls = None
        roundtrip_data = None
        query_vehicles = None
        query_locations = None
        visited = None
        query = None
        response = None
        session.expunge_all()
        raise e
    alls = None
    roundtrip_data = None
    vehicle_locations = None
    query_vehicles = None
    query_locations = None
    visited = None
    query = None
    session.expunge_all()
    session.close()
    return response


def grouped_driving_data_to_excel(data, threshold):
    locations = {loc["id"]: loc["address"] for loc in data.get("query_locations", [])}

    response = {}
    for vehicle in data.get("query_vehicles", []):
        vehicle_location = vehicle.get("location_id")
        if vehicle_location not in response:
            if vehicle_location is None:
                continue
            response[vehicle_location] = {
                "address": locations[vehicle_location],
                "data": [],
            }
        vehicle_data = next(
            filter(
                lambda veh: veh["idInt"] == vehicle.get("id"),
                data.get("vehicle_grouped"),
            )
        )
        response[vehicle_location]["data"].append(
            {
                "name": vehicle.get("name"),
                "x": list(map(lambda entry: entry.get("x"), vehicle_data.get("data"))),
                "y": list(map(lambda entry: entry.get("y"), vehicle_data.get("data"))),
            }
        )

    location_response = {}
    for location_id, location_address in locations.items():
        location_data = next(
            filter(lambda location: location["idInt"] ==
                   location_id, data.get("location_grouped"))
        )
        location_response[location_id] = {
            "address": location_address,
            "x": list(map(lambda entry: entry["x"], location_data.get("data", []))),
            "y": list(map(lambda entry: entry["y"], location_data.get("data", [])))
        }

    output = io.BytesIO()
    writer = pd.ExcelWriter(output, engine="xlsxwriter")
    workbook = writer.book
    worksheet = workbook.add_worksheet(name="Køretøjer")
    location_worksheet = workbook.add_worksheet(name="Lokationer")
    format_table = workbook.add_format({"bg_color": "#FFC7CE"})
    heading_format = workbook.add_format({"bold": True, "font_size": 14})
    cell_format = workbook.add_format({"border": 1})
    cell_format.set_align("left")

    row = 0
    col = 0

    max_col_width = 0
    for location_id, location_content in response.items():
        worksheet.write(row, col, location_content.get("address"), heading_format)
        row += 1
        start_row = row
        dates = location_content.get("data")[0]["x"]
        headers = ["Køretøj"] + dates
        worksheet.write_row(row, col, headers)
        worksheet.set_column(1, 1 + len(dates), max(map(lambda x: len(x) + 2, dates)))
        row += 1

        for vehicle in location_content.get("data"):
            vehicle_name = vehicle.get("name", "")
            if len(vehicle_name) + 2 > max_col_width:
                max_col_width = len(vehicle_name) + 2
                worksheet.set_column(0, 0, max_col_width)
            worksheet.write(row, col, vehicle_name, cell_format)
            for i, value in enumerate(vehicle["y"]):
                worksheet.write(row, col + 1 + i, value)

            row += 1
        table_range = (start_row, 0, row - 1, len(dates))
        worksheet.add_table(
            *table_range,
            {
                "header_row": True,
                "style": "Table Style Medium 2",
                "columns": [
                    {"header": name, "format": format_table}
                    for name in headers
                ],
            },
        )

        worksheet.conditional_format(
            *table_range,
            {
                "type": "2_color_scale",
                "min_type": "num",
                "max_type": "num",
                "min_color": "#FF0000",
                "max_color": "#FFFFFF",
                "min_value": 0,
                "max_value": threshold,
            },
        )
        row += 2

    row = 0
    col = 0

    max_col_width = 0
    location_content = list(location_response.values())
    if location_content:
        dates = location_content[0]["x"]
        headers = ["Lokation"] + dates
        location_worksheet.set_column(
            1, 1 + len(dates), max(map(lambda x: len(x) + 2, dates)))
        row += 1

        for location_data in location_content:
            location_name = location_data.get("address")
            if len(location_name) + 2 > max_col_width:
                max_col_width = len(location_name) + 2
                location_worksheet.set_column(0, 0, max_col_width)
            location_worksheet.write(row, col, location_name)
            for i, value in enumerate(location_data["y"]):
                location_worksheet.write(row, col + 1 + i, value)

            row += 1
        table_range = (0, 0, row - 1, len(dates))
        location_worksheet.add_table(
            *table_range,
            {
                "header_row": True,
                "style": "Table Style Medium 2",
                "columns": [
                    {"header": name, "format": format_table}
                    for name in headers
                ]
            }
        )
        location_worksheet.conditional_format(
            *table_range,
            {
                "type": "2_color_scale",
                "min_type": "num",
                "max_type": "num",
                "min_color": "#FF0000",
                "max_color": "#FFFFFF",
                "min_value": 0,
                "max_value": threshold
            }
        )

    writer.close()
    output.seek(0)

    return output


def get_aggregation_key(date_key, level):
    month = {
        1: "januar",
        2: "februar",
        3: "marts",
        4: "april",
        5: "maj",
        6: "juni",
        7: "juli",
        8: "august",
        9: "september",
        10: "oktober",
        11: "november",
        12: "december",
    }
    # das - timedelta(days=das.weekday()), das - timedelta(days=das.weekday()) + timedelta(days=7)
    date_date = date_key.date()
    if level == "day":
        return date_date.strftime("%d/%m/%y"), date_date, date_date + dayDelta
    elif level == "week":
        return (
            f"{date_date.isocalendar()[0]}, uge {date_date.isocalendar()[1]}",
            date_date - datetime.timedelta(days=date_date.weekday()),
            date_date - datetime.timedelta(days=date_date.weekday()) + weekDelta,
        )
    elif level == "month":
        return (
            f"{date_key.year}, {month[date_key.month]}",
            date_date - datetime.timedelta(days=date_date.day - 1),
            date_date - datetime.timedelta(days=date_date.day - 1) + monthDelta,
        )


def date_duration_getter(start_date, end_date, level):
    list_of_keys = []
    for count in range((end_date - start_date).days):
        list_of_keys.append(
            get_aggregation_key(
                datetime.datetime.combine(start_date, datetime.time(0, 0, 0))
                + datetime.timedelta(days=count),
                level,
            )
        )
    return sorted(list(set(list_of_keys)), key=lambda item: item[1])


def mark_period_as_in_use(grouped_dict, key):
    """
    Mark a period as 'in use but not driving' by setting distance to None.
    Only sets to None if the period hasn't been processed yet (distance is exactly 0).

    Args:
        grouped_dict: Dictionary of {key: {"distance": value, ...}}
        key: The key to mark
    """
    current_distance = grouped_dict[key]["distance"]
    if current_distance is not None and current_distance == 0:
        grouped_dict[key]["distance"] = None


def add_distance_to_period(grouped_dict, key, distance):
    """
    Add distance to a period, handling None values (in-use periods).

    Args:
        grouped_dict: Dictionary of {key: {"distance": value, ...}}
        key: The key to add distance to
        distance: The distance to add
    """
    if grouped_dict[key]["distance"] is None:
        grouped_dict[key]["distance"] = 0
    grouped_dict[key]["distance"] += distance


def group_by_vehicle_location(
    driving_data: list[dict],
    start_date: datetime.datetime | datetime.date,
    end_date: datetime.datetime | datetime.date,
    vehicles: list[int],
    locations: list[int],
):
    """
    Aggregate driving data by vehicle and location over time periods.

    Automatically determines aggregation level based on date range:
        - <= 31 days: daily aggregation
        - <= 90 days: weekly aggregation
        - > 90 days: monthly aggregation

    Handles three data formats:
        - Embedded segments: roundtrips with 'trip_segments' array
        - Flat segments: individual segment records with 'roundtrip_start_time'/'roundtrip_end_time'
        - Plain roundtrips: simple roundtrip records without segment detail

    For segment data, tracks "in use but not driving" periods by setting distance to None
    for time periods where a vehicle was active (within roundtrip boundaries) but has no
    recorded segment distance. This distinguishes between:
        - 0: No activity in period
        - None: Vehicle in use but not driving (e.g., parked at destination)
        - >0: Actual driven distance

    Args:
        driving_data: List of driving records (roundtrips or segments)
        start_date: Start of date range
        end_date: End of date range
        vehicles: List of vehicle IDs to include
        locations: List of location IDs to include

    Returns:
        tuple of (vehicle_grouped, location_grouped) where each is a dict:
            - Key: (id, aggregation_period_string)
            - Value: {"distance": float|None, "startDate": date, "endDate": date}
    """
    duration_days = (end_date - start_date).days
    if duration_days <= 31:
        aggregation_level = "day"
    elif duration_days <= 90:
        aggregation_level = "week"
    else:
        aggregation_level = "month"

    unique_keys = date_duration_getter(start_date, end_date, aggregation_level)

    location_grouped = {
        (location, it[0]): {"distance": 0, "startDate": it[1], "endDate": it[2]}
        for location in locations
        for it in unique_keys
    }

    vehicle_grouped = {
        (vehicle, it[0]): {"distance": 0, "startDate": it[1], "endDate": it[2]}
        for vehicle in vehicles
        for it in unique_keys
    }

    processed_roundtrips = set()

    for record in driving_data:
        location_id = record["location_id"]
        vehicle_id = record["vehicle_id"]

        # normalise segment data - check for embedded segments or flattened segments
        has_embedded_segments = record.get("trip_segments") and len(record["trip_segments"]) > 0
        has_flat_segments = "roundtrip_start_time" in record

        if has_embedded_segments or has_flat_segments:
            # normalise common structure
            if has_embedded_segments:
                roundtrip_start = record["start_time"]
                roundtrip_end = record["end_time"]
                segments = record["trip_segments"]
                roundtrip_key = (vehicle_id, record["roundtrip_id"])
            else:
                roundtrip_start = record["roundtrip_start_time"]
                roundtrip_end = record["roundtrip_end_time"]
                segments = [{"start_time": record["start_time"], "distance": record["distance"]}]
                roundtrip_key = (vehicle_id, record["roundtrip_id"])

            # marking roundtrip period as "in use" only once per roundtrip
            if roundtrip_key not in processed_roundtrips:
                processed_roundtrips.add(roundtrip_key)
                trip_day_keys = date_duration_getter(roundtrip_start, roundtrip_end, aggregation_level)
                for aggregation_key, _, _ in trip_day_keys:
                    mark_period_as_in_use(vehicle_grouped, (vehicle_id, aggregation_key))

            # accounting the distance on the key
            for segment in segments:
                segment_aggregation_key, _, _ = get_aggregation_key(
                    segment["start_time"], aggregation_level
                )
                add_distance_to_period(vehicle_grouped, (vehicle_id, segment_aggregation_key), segment["distance"])
                location_grouped[(location_id, segment_aggregation_key)]["distance"] += segment["distance"]

        else:
            # plain roundtrip without segments
            aggregation_key, _, _ = get_aggregation_key(
                record["start_time"], aggregation_level
            )
            vehicle_grouped[(vehicle_id, aggregation_key)]["distance"] += record["distance"]
            location_grouped[(location_id, aggregation_key)]["distance"] += record["distance"]

    return vehicle_grouped, location_grouped


def to_plot_data(data_dict, filter_data):
    if filter_data and "address" in filter_data[0]:
        filter_data = [
            {"id": item["id"], "name": item["address"]} for item in filter_data
        ]

    data_id_grouped = {}

    for key, data in data_dict.items():
        key_id, key_string = key
        if key_id not in data_id_grouped:
            data_id_grouped[key_id] = {
                "id": next(filter(lambda item: item["id"] == key_id, filter_data)).get(
                    "name"
                ),
                "idInt": key_id,
                "data": [],
            }
        data_id_grouped[key_id]["data"].append(
            {
                "x": key_string,
                "y": data["distance"],
                "startDate": data["startDate"],
                "endDate": data["endDate"],
            }
        )

    return list(data_id_grouped.values())


def calc_possible(selected: list[int], shift_vals: list[dict]):
    timePos = 0
    for idx in selected:
        start = shift_vals[idx].get("shift_start")
        end = shift_vals[idx].get("shift_end")
        if end < start:
            start = datetime.datetime.combine(datetime.date(1, 1, 1), start)
            end = datetime.datetime.combine(datetime.date(1, 1, 2), end)
        else:
            start = datetime.datetime.combine(datetime.date(1, 1, 1), start)
            end = datetime.datetime.combine(datetime.date(1, 1, 1), end)
        timePos += (end - start).total_seconds()

    return timePos


@dataclass
class route_entry:
    start_time: datetime
    end_time: datetime


def date_range(start_date, end_date):
    current_date = start_date
    while current_date <= end_date:
        yield current_date
        current_date += datetime.timedelta(days=1)


def calculate_timeactivity(trips: list[dict], shifts: list[dict], shift_filter: list[int], vehicles: list[dict], start_date: datetime.date, end_date: datetime.date):
    if shift_filter is None or len(shift_filter) == 0:
        shift_filter = list(range(len(shifts)))

    time_possible = calc_possible(shift_filter, shifts)

    used_shifts = [shifts[idx] for idx in shift_filter]

    date_spent = {vehicle["id"]: {datestr.strftime("%d/%m/%y"): {"timeSpent": 0, "timePossible": time_possible, "percentage": 0}
                                  for datestr in date_range(start_date, end_date)} for vehicle in vehicles}

    midnight = datetime.time(0, 0, 0)
    fiftynine = datetime.time(23, 59, 59, 999999)

    for trip in trips:
        vehicle_id = trip.get("vehicle_id")
        if vehicle_id not in date_spent:
            date_spent[vehicle_id] = {}
        # here add the vehicle id if not exists
        current_date = trip.get("start_time").date()
        current_start = trip.get("start_time")
        end_date = trip.get("end_time").date() + datetime.timedelta(days=1)
        for shift in used_shifts:
            shift_start = shift.get("shift_start")
            shift_end = shift.get("shift_end")
            while end_date > current_date:
                calc_two = False
                end_time = trip.get("end_time")
                if end_time.date() > current_date:
                    end_time = datetime.datetime.combine(current_date, fiftynine)

                if shift.get("shift_end") < shift.get("shift_start"):
                    shift_beginning = midnight <= current_start.time() < shift_end
                    shift_ending = fiftynine >= end_time.time() > shift_start
                    calc_two = shift_beginning and shift_ending

                if calc_two:
                    # beginning of the day
                    timespent = alternate(
                        route_entry(datetime.datetime.combine(
                            current_date, midnight), end_time),
                        midnight, shift_end
                    )

                    # end of the day
                    timespent += alternate(
                        route_entry(current_start, datetime.datetime.combine(
                            current_date, fiftynine)),
                        shift_start, fiftynine
                    )

                else:
                    timespent = alternate(
                        route_entry(current_start, end_time), shift_start, shift_end
                    )

                dstr = current_date.strftime("%d/%m/%y")
                if dstr not in date_spent[vehicle_id]:
                    date_spent[vehicle_id][dstr] = {
                        "timeSpent": 0, "timePossible": time_possible}
                date_spent[vehicle_id][dstr]["timeSpent"] += round(timespent)
                current_date += datetime.timedelta(days=1)
                current_start = datetime.datetime.combine(current_date, midnight)

            # reset again for the new shift
            current_date = trip.get("start_time").date()
            current_start = trip.get("start_time")

    with_percentage = {}
    for vehicle_id, entries in date_spent.items():
        with_percentage[vehicle_id] = {}
        for date, values in entries.items():
            with_percentage[vehicle_id][date] = values
            with_percentage[vehicle_id][date]["percentage"] = values["timeSpent"] / \
                values["timePossible"]

    return with_percentage


def get_availability(
    session: Session, 
    start_date: datetime.date, 
    end_date: datetime.date, 
    locations: Optional[List[int]],
    vehicles: Optional[List[int]],
    departments: Optional[List[str | None]],
    forvaltninger: Optional[List[str | None]]
):
    vehicles_query = session.query(Cars.id).filter(
        Cars.omkostning_aar.isnot(None),
        (Cars.wltp_el.isnot(None) | Cars.wltp_fossil.isnot(None)),
        Cars.location.isnot(None),
        and_(
            or_(Cars.disabled.is_(None), Cars.disabled == False),
            or_(Cars.deleted.is_(None), Cars.deleted == False))
    )
    if departments:
        vehicles_query = vehicles_query.filter(Cars.department.in_(departments))
    if vehicles:
        vehicles_query = vehicles_query.filter(Cars.id.in_(vehicles))

    if forvaltninger:
        if "Ingen Forvaltning" in forvaltninger:
            vehicles_query = vehicles_query.filter(
                or_(Cars.forvaltning.is_(None), Cars.forvaltning.in_(forvaltninger))
            )
        else:
            vehicles_query = vehicles_query.filter(
                Cars.forvaltning.in_(forvaltninger))

    vehicles_query_join = vehicles_query.subquery()

    roundtrips = (
        session.query(
            RoundTrips.id,
            RoundTrips.car_id,
            RoundTrips.start_time,
            RoundTrips.end_time,
            RoundTrips.distance,
            RoundTrips.start_location_id,
            RoundTrips.aggregation_type,
        )
        .join(vehicles_query_join)
        .filter(
            RoundTrips.start_time >= start_date,
            RoundTrips.end_time <= end_date,
        )
    )
    if locations:
        roundtrips = roundtrips.filter(RoundTrips.start_location_id.in_(locations))
        vehicles_query = vehicles_query.filter(Cars.location.in_(locations))

    cars_count = vehicles_query.count()
    cars_count = 0 if pd.isna(cars_count) else cars_count
    result = roundtrips.all()

    time_table: pd.DatetimeIndex = pd.date_range(start=start_date, end=end_date,
                                                 freq=datetime.timedelta(minutes=1), name="timestamp")

    df = pd.DataFrame(np.zeros(len(time_table)), index=time_table, columns=['y'])

    def get_cars_in_period(row):
        cars_on_route = len(list(filter(lambda trip: trip.start_time <= row.name and trip.end_time >= row.name, result)))
        return cars_count - cars_on_route
    df["y"] = df.apply(get_cars_in_period, axis=1)
    df = df.resample("5Min").mean().round(0)

    df['x'] = df.index

    least_availability = cars_count if len(df) == 0 else df["y"].min()
    max_availability = cars_count if len(df) == 0 else df["y"].max()
    average_availability = cars_count if len(df) == 0 else df["y"].mean()
    return VehicleAvailability(
        data=df.to_dict('records'),
        totalVehicles=cars_count,
        leastAvailability=least_availability,
        maxAvailability=max_availability,
        averageAvailability=average_availability
    )


def eligible_saved_vehicles(session: Session):
    total_eligible_cars = session.query(
        func.count(Cars.id).label("count")
    ).filter(
        and_(
            or_(Cars.disabled.is_(None), Cars.disabled == False),
            or_(Cars.deleted.is_(None), Cars.deleted == False),
            or_(Cars.test_vehicle.is_(None), Cars.test_vehicle == False)
        ),
    ).scalar()
    return total_eligible_cars


def active_vehicles(since_date: datetime.date, session: Session):
    total_active_vehicles = session.query(
        func.count(
            distinct(RoundTrips.car_id)
        )
    ).filter(
        RoundTrips.start_time > since_date
    ).scalar()
    return total_active_vehicles


def get_non_fossil_km_share(since_date: datetime.date, session: Session):
    total_km_query = (
        session.query(func.sum(RoundTrips.distance))
        .filter(RoundTrips.start_time > since_date)
        .scalar()
    )

    non_fossil_km_query = (
        session.query(func.sum(RoundTrips.distance))
        .join(Cars, Cars.id == RoundTrips.car_id)
        .filter(
            RoundTrips.start_time > since_date,
            Cars.fuel.in_([3, 7, 8, 10]),
        )
        .scalar()
    )

    if not total_km_query or total_km_query == 0:
        return 0

    return non_fossil_km_query / total_km_query if non_fossil_km_query else 0


def get_number_of_simulations(since_date: datetime.date, session: Session):
    # session is an input to keep consistent callable from kpis endpoint
    pattern = f"celery-task-meta-{os.getenv('CELERY_QUEUE', 'default')}:*simulation*"
    r = redis.Redis.from_url(os.getenv('CELERY_BACKEND_URL'))
    simulation_count = 0
    for key in r.scan_iter(match=pattern, count=100):
        task_date = re.search("\d{4}-\d{2}-\d{2}", key.decode())
        if not task_date:
            logger.warning(
                f"Some celery keys do not follow expected format: "
                f"celery-task-meta-<queue>:<task_name>:<datetime>:<uid>: {key}"
            )
            continue

        task_date = datetime.date.fromisoformat(task_date.group())
        if task_date > since_date:
            simulation_count += 1

    return simulation_count


def get_usage_on_locations(session: Session, total_selected_time: float | int, since_date: datetime.date) -> List[LocationUsage]:
    """
     Calculate and return usage statistics for each location based on car round trips since a given date.

     Args:
         sessions: A callable that returns a SQLAlchemy session context.
         total_selected_time: The total time available per car, used to compute available time.
         since_date: The starting date from which round trips are considered.

     Returns:
         A list of LocationUsage objects with computed usage, car counts, total available time, and usage ratio.
     """
    dialect = session.bind.engine.dialect.name
    if dialect == "sqlite":
        time_function = func.strftime("%s", RoundTrips.end_time) - func.strftime("%s", RoundTrips.start_time)
    elif dialect == "mysql":
        time_function = func.timestampdiff(text("SECOND"), RoundTrips.start_time, RoundTrips.end_time)
    else:
        time_function = cast(
            func.datediff(literal_column("SECOND"), RoundTrips.start_time, RoundTrips.end_time),
            BigInteger
        )

    car_usage = (
        session.query(
            Cars.id.label("car_id"),
            Cars.location.label("location_id"),
            (
                func.coalesce(
                    func.sum(time_function),
                    0
                )
            ).label("usage")
        )
        .outerjoin(
            RoundTrips,
            and_(
                Cars.id == RoundTrips.car_id,
                RoundTrips.start_time >= since_date
            )
        )
        .filter(
            and_(
                or_(Cars.disabled.is_(None), Cars.disabled == False),
                or_(Cars.deleted.is_(None), Cars.deleted == False)
            )
        )
        .group_by(Cars.id, Cars.location)
        .subquery()
    )

    location_usage = (
        session.query(
            AllowedStarts.address,
            car_usage.c.location_id,
            func.count(car_usage.c.car_id).label("car_count"),
            func.sum(car_usage.c.usage).label("location_usage")
        )
        .group_by(car_usage.c.location_id, AllowedStarts.address)
        .join(AllowedStarts, AllowedStarts.id == car_usage.c.location_id)
    )
    location_details = []
    for row in location_usage:
        location_specifics = LocationUsage(**row._asdict())
        location_specifics.total_available_time = total_selected_time * location_specifics.car_count
        location_specifics.usage_ratio = location_specifics.location_usage / location_specifics.total_available_time
        location_details.append(location_specifics)
    return location_details


def get_week_dates(since_date: datetime.date) -> List[Tuple[datetime.date, datetime.date]]:
    """
    will take the since_date and return the start/end date pairs that bounds the week
    returns a list of tuples where first and second index is the start and end respectively
    """

    if isinstance(since_date, datetime.datetime):
        since_date = since_date.date()
    today = datetime.date.today()
    since_date_week_info = since_date.isocalendar()
    since_date_week_start = since_date - datetime.timedelta(days=since_date_week_info.weekday - 1)

    week_dates = []
    if today <= since_date_week_start:
        return week_dates
    start_date = since_date_week_start
    while start_date < today:
        week_dates.append(
            (start_date, start_date + weekDelta)
        )
        start_date += weekDelta

    return week_dates


def get_activity_on_locations(session: Session, since_date: datetime.date) -> List[LocationActivity]:
    """
    Returns weekly summaries containing total distance (activity) and car counts per location since a specified date.

    Args:
        session: Database session object.
        since_date (datetime/date): Starting date to include roundtrip data - will be calculated to week of the since_date

    Returns:
        List of records grouped by location and week, each including car count and total activity distance.

    Considerations on subqueries
    The first (subq) gathers roundtrip distances per car, location, and week.
    The second (car_count_subq) independently calculates the total cars available per location, regardless of trips in
    order to "penalise" inactive veicles.
    The final query combines these two to correctly match car counts with trip activities without inflating distances
    or miscounting cars.
    """
    dialect = session.bind.engine.dialect.name

    week_dates = get_week_dates(since_date)
    if not week_dates:
        return []
    first_date = sorted(week_dates)[0][0]

    if dialect == "sqlite":
        week_function = func.strftime('%Y', func.coalesce(RoundTrips.start_time, first_date)) + "-" + func.strftime(
            '%W', func.coalesce(RoundTrips.start_time, first_date))
    elif dialect == "mysql":
        week_function = func.concat(
            func.year(func.coalesce(RoundTrips.start_time, first_date)),
            "-",
            func.date_format(func.coalesce(RoundTrips.start_time, first_date), '%v')
        )
    else:
        week_function = func.concat(
            func.year(func.coalesce(RoundTrips.start_time, first_date)),
            "-",
            func.datepart(text("ISO_WEEK"), func.coalesce(RoundTrips.start_time, first_date))
        )

    subq = (
        session.query(
            Cars.id.label("car_id"),
            Cars.location.label("location_id"),
            AllowedStarts.address,
            func.coalesce(RoundTrips.start_time, first_date).label("start_time"),
            func.coalesce(RoundTrips.distance, 0).label("distance"),
            week_function.label("week_name"),
        ).filter(
            Cars.location.isnot(None)
        )
        .outerjoin(
            RoundTrips, and_(RoundTrips.start_time >= first_date, Cars.id == RoundTrips.car_id)
        )
        .outerjoin(AllowedStarts, and_(AllowedStarts.id == Cars.location))
        .subquery()
    )

    car_count_subq = (
        session.query(
            Cars.location.label("location_id"),
            func.count(distinct(Cars.id)).label("car_count")
        )
        .filter(
            Cars.location.isnot(None),
            or_(Cars.disabled.is_(None), Cars.disabled == False),
            or_(Cars.deleted.is_(None), Cars.deleted == False)
        )
        .group_by(Cars.location)
    ).subquery()

    car_activity = (
        session.query(
            car_count_subq.c.car_count,
            subq.c.location_id,
            subq.c.address,
            func.coalesce(func.sum(subq.c.distance), 0).label("activity"),
            subq.c.week_name
        )
        .join(car_count_subq, car_count_subq.c.location_id == subq.c.location_id)
        .group_by(subq.c.location_id, subq.c.address, subq.c.week_name, car_count_subq.c.car_count)
        .all()
    )

    week_mapping = {f"{start.year}-{start.isocalendar().week}": (start, end) for start, end in week_dates}
    location_details = {}
    for row in car_activity:
        loc = location_details.setdefault(
            row.location_id,
            LocationActivity(**row._asdict(), weeks=[], total_activity=0)
        )
        week_name = re.sub(r'(\d{4})-0(\d)', r'\1-\2', row.week_name)  # dialects differ in month zero-padding
        if week_name not in week_mapping:
            continue
        start_date, end_date = week_mapping[week_name]
        loc.weeks.append(WeekLocationActivity(
            week_name=week_name,
            activity=row.activity,
            average_activity=row.activity / row.car_count,
            start_date=start_date,
            end_date=end_date
        ))

        loc.total_activity += row.activity
        loc.total_average_activity = loc.total_activity / row.car_count / len(week_mapping)

    # ensure all weeks are present
    for loc in location_details.values():
        existing_weeks = {week.week_name for week in loc.weeks}
        missing_weeks = set(week_mapping) - existing_weeks
        for week_name in missing_weeks:
            start_date, end_date = week_mapping[week_name]
            loc.weeks.append(WeekLocationActivity(
                week_name=week_name,
                activity=0,
                average_activity=0,
                start_date=start_date,
                end_date=end_date
            ))

    return list(location_details.values())
