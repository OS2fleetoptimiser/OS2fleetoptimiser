from datetime import date
from json.decoder import JSONDecodeError
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic.error_wrappers import ValidationError
from sqlalchemy.orm import Session

from fleetmanager.statistics import (
    carbon_neutral_share,
    driving_data_to_excel,
    emission_series,
    get_summed_statistics,
    total_driven,
    get_daily_driving_data,
    group_by_vehicle_location,
    to_plot_data,
    grouped_driving_data_to_excel,
    get_availability
)

from ..dependencies import get_session
from .schemas import (
    DrivingDataResult,
    GroupedDrivingDataResult,
    OverviewInput,
    StatisticOverview,
    TimeSeriesData,
    shift_dict,
)
from ...statistics.util import calculate_timeactivity

router = APIRouter(
    prefix="/statistics",
)


#  / statistics
@router.get("/sum", response_model=StatisticOverview)
async def summed_statistics(
        session: Session = Depends(get_session),
        start_date: date = None,
        end_date: date = None,
        locations: Optional[List[int]] = Query(None),
        forvaltninger: Optional[List[str]] = Query(None)
):
    """
    Get the three major figures for all valid roundtrips in the database; total emission, total driven kilometers,
    total share of kilometers driven in carbon-neutral vehicles.
    """
    return get_summed_statistics(session, start_date=start_date, end_date=end_date, locations=locations, forvaltninger=forvaltninger)


#  / carbon - neutral - share
@router.get("/overview", response_model=TimeSeriesData)
async def get_overview_series(
    request: OverviewInput = Depends(),
    locations: Optional[List[int]] = Query(None),
    forvaltninger: Optional[List[str]] = Query(None),
    session: Session = Depends(get_session),
):
    """
    Get time series data on a date and locations criteria. Sums of valid roundtrips in the database that has been
    driven by a "registered" vehicle. Can return the time series of emission, total driven kilometers and the share
    of carbon-neutral kilometers.
    """

    view_function = {
        "emission": emission_series,
        "driven": total_driven,
        "share": carbon_neutral_share,
    }.get(request.view)

    data = view_function(
        session,
        start_date=request.start_date,
        end_date=request.end_date,
        locations=locations,
        forvaltninger=forvaltninger
    )

    x_axis = data.get("x")
    y_axis = data.get("y")
    result = list(
        map(lambda x, y: {"x": x, "y": 0 if pd.isna(y) else y}, x_axis, y_axis)
    )

    return {"data": result}


# #  / driving - data
@router.get("/grouped-driving-data", response_model=GroupedDrivingDataResult)
async def get_grouped_driving_data(
    start_date: date,
    end_date: date,
    locations: Optional[List[int]] = Query(None),
    vehicles: Optional[List[int]] = Query(None),
    shifts: Optional[List[str]] = Query(None),
    departments: Optional[List[str | None]] = Query(None),
    forvaltninger: Optional[List[str | None]] = Query(None),
    session: Session = Depends(get_session),
    trip_segments: Optional[bool] = False,
    as_segments: Optional[bool] = False,
    selected_shifts: Optional[List[int]] = Query(None),
    download: Optional[bool] = False,
    threshold: Optional[int] = 40
):
    """
    Get driving data on the below filters. Will "shiftify" the roundtrips, meaning that the roundtrips will be returned
    as their aggregated state based on the input shifts. If shifts are explicitly set in the query to shifts=[], shifts
    will not be applied to the roundtrips. If shifts is not entered, shifts will seek to be loaded from the database;
    simulationsettings name vagt_dashboard. All input filters will be applied on an all basis, meaning that roundtrips
    will be pulled if all filters are true. Returned shift id refer to the order in the shifts list.
    """

    if departments:
        departments = [(dep if dep != "null" else None) for dep in departments]

    if shifts:
        try:
            shifts = shift_dict(shifts)
        except (ValidationError, JSONDecodeError):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "check shifts times and "
                'input: [{"shift_start": "8:00", "shift_end": "18:00"}, {"shift_start": "18:00", "shift_end": "00:00"},'
                ' {"shift_start": "00:00", "shift_end": "8:00", "shift_break": "4:00"}]',
            )
    else:
        shifts = None

    query_data = get_daily_driving_data(
        session,
        start_date,
        end_date,
        locations,
        vehicles,
        shifts,
        departments,
        forvaltninger,
        trip_segments,
        as_segments,
    )

    driving_data = query_data["driving_data"]

    if selected_shifts is not None and len(selected_shifts) > 0:
        driving_data = list(
            filter(lambda trip: trip.get("shift_id") in selected_shifts, driving_data)
        )

    vehicle_grouped, location_grouped = group_by_vehicle_location(
        driving_data,
        start_date,
        end_date,
        locations=[loc["id"] for loc in query_data.get("query_locations")],
        vehicles=[veh["id"] for veh in query_data.get("query_vehicles")],
    )

    location_grouped = to_plot_data(
        location_grouped, filter_data=query_data["query_locations"]
    )
    vehicle_grouped = to_plot_data(
        vehicle_grouped, filter_data=query_data["query_vehicles"]
    )
    response = {
        "query_start_date": start_date,
        "query_end_date": end_date,
        "query_locations": query_data.get("query_locations"),
        "query_vehicles": query_data.get("query_vehicles"),
        "shifts": query_data.get("shifts"),
        "vehicle_grouped": vehicle_grouped,
        "location_grouped": location_grouped,
    }
    if download:
        stream = grouped_driving_data_to_excel(
            response,
            threshold,
        )
        current_date = date.today().strftime("%Y-%m-%d")
        filename = f"Køretøjs aktivitet {current_date}.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        return StreamingResponse(stream, headers=headers)

    driving_data = None
    query_data = None
    return response


@router.get("/driving-data", response_model=DrivingDataResult)
async def get_driving_data(
    start_date: date,
    end_date: date,
    locations: Optional[List[int]] = Query(None),
    vehicles: Optional[List[int]] = Query(None),
    shifts: Optional[List[str]] = Query(None),
    shift_filter: Optional[List[int]] = Query(None),
    departments: Optional[List[str | None]] = Query(None),
    forvaltninger: Optional[List[str | None]] = Query(None),
    session: Session = Depends(get_session),
    trip_segments: Optional[bool] = False,
    download: Optional[bool] = False,
    threshold: Optional[int] = None,
    as_segments: Optional[bool] = False,
    with_timedelta: Optional[bool] = False,
):
    """
    Get driving data on the below filters. Will "shiftify" the roundtrips, meaning that the roundtrips will be returned
    as their aggregated state based on the input shifts. If shifts are explicitly set in the query to shifts=[], shifts
    will not be applied to the roundtrips. If shifts is not entered, shifts will seek to be loaded from the database;
    simulationsettings name vagt_dashboard. All input filters will be applied on an all basis, meaning that roundtrips
    will be pulled if all filters are true. Returned shift id refer to the order in the shifts list.
    """
    if departments:
        departments = [(dep if dep != "null" else None) for dep in departments]

    if shifts:
        try:
            shifts = shift_dict(shifts)
        except (ValidationError, JSONDecodeError):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "check shifts times and "
                'input: [{"shift_start": "8:00", "shift_end": "18:00"}, {"shift_start": "18:00", "shift_end": "00:00"},'
                ' {"shift_start": "00:00", "shift_end": "8:00", "shift_break": "4:00"}]',
            )
    else:
        shifts = None

    if download:
        stream = driving_data_to_excel(
            get_daily_driving_data(
                session,
                start_date,
                end_date,
                locations,
                vehicles,
                shifts,
                departments,
                forvaltninger,
                as_segments=as_segments,
            ),
            threshold,
        )
        current_date = date.today().strftime("%Y-%m-%d")
        filename = f"Køretøjs aktivitet {current_date}.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        return StreamingResponse(stream, headers=headers)

    query_data = get_daily_driving_data(
        session,
        start_date,
        end_date,
        locations,
        vehicles,
        shifts,
        departments,
        forvaltninger,
        trip_segments,
        as_segments,
    )
    timeDelta = {}
    if with_timedelta:
        timeDelta = calculate_timeactivity(
            trips=query_data.get("driving_data"),
            shifts=query_data.get("shifts"),
            shift_filter=shift_filter,
            vehicles=query_data.get("query_vehicles"),
            start_date=start_date,
            end_date=end_date,
        )

    query_data["timedelta"] = timeDelta

    return query_data


@router.get("/availability")
async def get_vehicle_availability(
        start_date: date,
        end_date: date,
        locations: Optional[List[int]] = Query(None),
        vehicles: Optional[List[int]] = Query(None),
        departments: Optional[List[str | None]] = Query(
            None),
        forvaltninger: Optional[List[str | None]] = Query(
            None),
        session: Session = Depends(get_session),
):
    """
    Get availability for vehicles 
    """
    if departments:
        departments = [(dep if dep != "null" else None) for dep in departments]

    result = get_availability(
        session=session, start_date=start_date, end_date=end_date, locations=locations, departments=departments, forvaltninger=forvaltninger, vehicles=vehicles)

    return result
