from datetime import datetime

from pydantic import BaseModel


class Workshop(BaseModel):
    id: int | None  # have to be nullable in order to create new
    name: str | None
    address: str | None
    latitude: float
    longitude: float
    addition_date: datetime | None


class WorkshopSettings(BaseModel):
    min_visit_hours: float


class WorkshopVisit(BaseModel):
    id: int
    car_id: int
    workshop_id: int
    workshop_name: str | None
    workshop_address: str | None
    plate: str | None
    start_time: datetime | None
    end_time: datetime | None
    duration: float | None  # duration of the visit in hours
