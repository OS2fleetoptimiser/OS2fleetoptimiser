import json
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
import os
from sqlalchemy.orm import Session
import redis
import pickle

from fleetmanager.configuration import (
    get_all_configurations_from_db,
    load_bike_configuration_from_db,
    load_shift_settings,
    load_simulation_settings,
    validate_settings,
)
from fleetmanager.fleet_simulation import fleet_simulator, simulation_results_to_excel, load_fleet_simulation_history
from fleetmanager.tasks import get_task_id, run_fleet_simulation

from ..configuration.schemas import (
    BikeSettings,
    BikeSlot,
    LocationShifts,
    Shift,
    SimulationSettings,
)
from ..dependencies import get_session
from .schemas import (
    FleetSimulationOptions,
    FleetSimulationOut,
    FleetSimulationResult,
    FleetSimulationHistory
)

router = APIRouter(
    prefix="/fleet-simulation",
)


@router.post("/simulation", response_model=FleetSimulationOut)
async def simulate_start(
    simulation_in: FleetSimulationOptions,
    session: Session = Depends(get_session),
):
    """
    Simulate with a new constructed fleet  on data from a specific location, vehicles and dates. Results will be
    compared to the actual driving scenario. Returns an id that should be used to retrieve the results.
    """
    # todo add validation for expected error such as mismatch location and current vehicles and
    #  if no trips in the selected period
    #  vehicles that doesn't exist

    settings = simulation_in.settings

    # fill in the missing pieces
    # if the settings does not exists at all
    if settings is None or settings.simulation_settings is None:
        settings = get_all_configurations_from_db(session)
        simulation_in.settings = validate_settings(settings)
    # if some settings are not populated load from db
    elif len(simulation_in.settings.simulation_settings.dict(exclude_none=True)) != len(
        SimulationSettings.__fields__
    ):
        already_set = simulation_in.settings.simulation_settings.dict(
            exclude_none=True
        ).keys()
        sim_settings = load_simulation_settings(session)
        for key, value in sim_settings.items():
            if key not in already_set:
                setattr(simulation_in.settings.simulation_settings, key, value)

    # if the bike settings are not explicitly set to null load from db
    if "bike_settings" not in simulation_in.settings.dict(exclude_none=True):
        bike_settings = load_bike_configuration_from_db(session)
        simulation_in.settings.bike_settings = BikeSettings(
            max_km_pr_trip=bike_settings.get("max_km_pr_trip", None),
            percentage_of_trips=bike_settings.get("percentage_of_trips", None),
            bike_slots=[
                BikeSlot(bike_start=start, bike_end=end)
                for start, end in zip(
                    bike_settings.get("bike_start", []),
                    bike_settings.get("bike_end", []),
                )
            ],
            bike_speed=bike_settings.get("bike_speed", 20),
            electrical_bike_speed=bike_settings.get("electrical_bike_speed", 30),
        )

    # if the shift settings are not explicitly set to null load from db
    if "shift_settings" not in simulation_in.settings.dict(exclude_none=True):
        shifts = load_shift_settings(session, location=simulation_in.location_id)
        simulation_in.settings.shift_settings = [
            LocationShifts(
                location_id=simulation_in.location_id,
                shifts=[
                    Shift(
                        shift_start=shift["shift_start"],
                        shift_end=shift["shift_end"],
                        shift_break=shift["break"],
                    )
                    for shift in shifts
                ],
            )
        ]
    r = run_fleet_simulation.apply_async(args=(simulation_in,), task_id=get_task_id("fleet_simulation"))
    return FleetSimulationOut(id=r.id, status=r.status, result=None)


@router.get("/simulation/{simulation_id}", response_model=FleetSimulationOut)
async def get_simulation(
    simulation_id: str,
    sec_fetch_dest: str = Header(None),
    session: Session = Depends(get_session),
    download: bool = False,
):
    """
    Returns the results of the simulation. If accept is specified to
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    in the header response will be xlsx format, otherwise result is return as "application/json".
    """
    r = AsyncResult(simulation_id)
    if r.successful():
        result = r.get()
        if (sec_fetch_dest == "document" or download) and "driving_book" in result:
            stream, location = simulation_results_to_excel(result, session)
            headers = {
                "Content-Disposition": f'attachment; filename="simulation_results_{location}.xlsx"',
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
            return StreamingResponse(stream, headers=headers)
    else:
        result = None
    return FleetSimulationOut(id=r.id, status=r.status, result=result)


@router.get("/simulation-history", response_model=list[FleetSimulationHistory])
async def get_fleet_simulation_history(session: Session = Depends(get_session)):
    r = redis.Redis(host="redis", port=6379)
    return load_fleet_simulation_history(session, r)
