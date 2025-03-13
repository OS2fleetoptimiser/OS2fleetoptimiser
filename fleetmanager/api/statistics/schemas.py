import json
from datetime import date, datetime
from typing import List, Literal

from fastapi import Query
from pydantic import BaseModel, Field, validator

from ..configuration.schemas import LocationShifts, Shift, Location, Vehicle


class StatisticOverview(BaseModel):
    first_date: date | None = Field(
        description="The date of the first roundtrip in the database"
    )
    last_date: date | None = Field(
        description="The date of the latest roundtrip in the database"
    )
    total_driven: int | None = Field(
        0, description="Sum of all roundtrips in the database"
    )
    total_emission: float | None = Field(0, description="Sum of total CO2e")
    share_carbon_neutral: int | None = Field(
        0, description="Percentage of roundtrips driven by non-fossil vehicles"
    )
    total_roundtrips: int | None = Field(
        0, description="Total number of roundtrips in database"
    )

    @validator("share_carbon_neutral")
    def share_percentage(cls, v):
        if v is None:
            return 0
        if 0 > v or 100 < v:
            raise ValueError("Share of carbon neutral should be between 0-100")
        return v


class TimeSeriesDataPoint(BaseModel):
    x: date
    y: float


class TimeDataPoint(BaseModel):
    x: datetime
    y: float


class TimeSeriesData(BaseModel):
    data: list[TimeSeriesDataPoint]


class OverviewInput(BaseModel):
    view: Literal["emission", "driven", "share"]
    start_date: date
    end_date: date


class DashboardShifts(LocationShifts):
    location_id: int | None


def shift_dict(shifts: List[str] = Query(...)) -> DashboardShifts:
    if len(shifts[0]) == 0:
        return DashboardShifts(location_id=None, shifts=[])

    parsed = DashboardShifts(
        location_id=None,
        shifts=[
            Shift(
                shift_start=shift.get("shift_start", None),
                shift_end=shift.get("shift_end", None),
                shift_break=shift.get("shift_break", None),
            )
            for shift in list(map(json.loads, shifts))
        ]
    )

    return parsed


class vehicle(BaseModel):
    id: int
    name: str
    location_id: int | None


class DrivingSegment(BaseModel):
    start_time: datetime
    end_time: datetime
    distance: float


class DrivingData(BaseModel):
    vehicle_id: int | None
    location_id: int | None
    roundtrip_id: int | None
    shift_id: int | None
    start_time: datetime | None
    end_time: datetime | None
    distance: float | None
    plate: str | None
    make: str | None
    model: str | None
    aggregation_type: str | None
    trip_segments: list[DrivingSegment] | None
    department: str | None


class DrivingDataResult(BaseModel):
    query_start_date: date | None
    query_end_date: date | None
    query_locations: list[Location] | None
    query_vehicles: list[vehicle] | None
    shifts: list[dict] | None
    driving_data: list[DrivingData] | None
    timedelta: dict | None


class PlotData(BaseModel):
    x: str
    y: int | None
    startDate: date
    endDate: date


class VehicleLocationPlotData(BaseModel):
    id: str
    idInt: int
    data: list[PlotData]


class GroupedDrivingDataResult(DrivingDataResult):
    vehicle_grouped: list[VehicleLocationPlotData] | None
    location_grouped: list[VehicleLocationPlotData] | None

class VehicleAvailability(BaseModel):
    totalVehicles: int
    maxAvailability: int
    leastAvailability: int
    averageAvailability: int
    data: list[dict]


KPIs = Literal[
    "total_saved_vehicles",
    "active_vehicles_last_month",
    "total_simulations_last_month",
    "non_fossil_share_last_month"
]
