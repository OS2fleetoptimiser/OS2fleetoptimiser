from datetime import date

from pydantic import BaseModel, Field
from typing import Literal, List, Dict
from fleetmanager.api.configuration.schemas import Vehicle, Location


class Locations(BaseModel):
    locations: list[Location] = Field(description="List of Locations")


class LocationVehiclesIn(BaseModel):
    start_date: date = Field(
        ..., description="Start date of the selected simulation period"
    )
    end_date: date = Field(
        ..., description="End date of the selected simulation period"
    )
    location_id: int | None = Field(
        description="Location id if only one location view should be returned"
    )


class VehicleView(Vehicle):
    status: Literal[
        "ok", "dataMissing", "locationChanged", "leasingEnded", "notActive"
    ] | None = Field(
        example="ok",
        description="Status of the vehicle: ok, dataMissing, "
        "locationChanged, leasingEnded or notActive",
    )


class LocationVehicles(BaseModel):
    id: int | None = Field(example=1, description="ID of the location")
    address: str | None = Field(
        example="Njalsgade, 2300 København S", description="The address of the location"
    )
    vehicles: list[VehicleView] = Field(description="List of vehicles")


class LocationsVehicleList(BaseModel):
    locations: list[LocationVehicles]
