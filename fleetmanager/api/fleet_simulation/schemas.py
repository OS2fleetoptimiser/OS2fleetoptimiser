from typing import Literal

from celery.states import ALL_STATES
from pydantic import BaseModel, Field, validator

from ..configuration.schemas import SimulationConfiguration
from ..simulation_setup.schemas import LocationVehiclesIn


class SimulationVehicles(BaseModel):
    id: int = Field(
        example=1,
        description="Car id of the vehicle that should be included in the simulation",
    )
    simulation_count: int | None = Field(
        example=5,
        description="How many vehicles of this vehicle id should "
        "be in the simulation fleet",
    )


class FleetSimulationOptions(LocationVehiclesIn):
    # fields are required
    location_id: int | None = Field(
        description="Location id of the location that should be simulated"
    )
    location_ids: list[int] | None = Field(
        description="Location ids of multiple selected simulation locations"
    )
    intelligent_allocation: bool | None = Field(
        False,
        description="Should intelligent allocation be used. Optimal "
        "allocation of trips weighed between cost pr km and "
        "emission.",
    )
    limit_km: bool | None = Field(
        False,
        description="Should the simulation stop utilising vehicles when they reach "
        "their allowed km/year according to the lease contract",
    )
    simulation_vehicles: list[SimulationVehicles] | None = Field(
        example=[
            {"id": 2, "simulation_count": 3},
            {"id": 3, "simulation_count": 2},
        ],
        description="All vehicles selected for simulation. Simulation fleet will be build on this list",
    )
    current_vehicles: list[int] = Field(
        description="Ids of the cars that are selected from the current fleet"
    )
    settings: SimulationConfiguration | None


class FleetSimulationResult(BaseModel):
    number_of_trips: int = Field(
        example=54, description="The number of trips in the date range"
    )
    unallocated: int | None = Field(
        example=7,
        description="The number of trips that could not be allocated in the simulation",
    )
    financial_savings: float | None = Field(
        example=30213,
        description="The financial savings in the simulation, when "
        "comparing the current/actual fleet with the simulation"
        " fleet",
    )
    co2e_savings: float | None = Field(
        example=0.121,
        description="Ton CO2e savings in the simulation, when comparing the "
        "current/actual fleet with the simulation fleet",
    )
    driving_book: list | None = Field(description="Driving book")
    simulation_options: FleetSimulationOptions | None = Field(
        description="The options/settings used in the simulation"
    )
    results: dict | None = Field(description="Detailed results of the simulation")


class FleetSimulationOut(BaseModel):
    id: str
    status: Literal[tuple(ALL_STATES)]
    result: FleetSimulationResult | None


class FleetSimulationHistory(BaseModel):
    id: str
    start_date: str
    end_date: str
    location: str
    locations: str | None
    simulation_date: str


class SimulationHighlight(BaseModel):
    id: str
    unallocated: int
    financial_savings: float
    co2e_savings: float
    location_ids: list[int]
    simulation_type: Literal["fleet", "goal"]
    addresses: list[str]
    simulation_date: str
    fleet_change: int
