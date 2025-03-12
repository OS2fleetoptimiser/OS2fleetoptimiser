import pickle
import redis

import redis.asyncio as redisAsync
from celery.result import AsyncResult
from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, Header
import os
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse
from websockets.exceptions import ConnectionClosedError

from fleetmanager.configuration import (
    get_all_configurations_from_db,
    load_bike_configuration_from_db,
    load_shift_settings,
    load_simulation_settings,
    validate_settings,
)
from fleetmanager.goal_simulation.util import load_goal_simulation_history
from fleetmanager.tasks import get_task_id, run_goal_simulation

from ..configuration.schemas import (
    BikeSettings,
    BikeSlot,
    LocationShifts,
    Shift,
    SimulationSettings,
)
from ..dependencies import get_session
from .schemas import GoalSimulationOptions, GoalSimulationOut, GoalSimulationHistory
from fleetmanager.fleet_simulation import simulation_results_to_excel

router = APIRouter(
    prefix="/goal-simulation",
)


@router.post("/simulation", response_model=GoalSimulationOut)
async def goal_simulate(
    simulation_in: GoalSimulationOptions, session: Session = Depends(get_session)
):
    """
    Run goal simulation. Test what fleet would be the optimal based on a range of parameters. Fixed cars will only
    be removed if there's excess capacity in the fleet. Trips will be pulled from selected date range, location and
    current_cars. So if there are no current_cars (which is our comparison fleet) we'll have no trips. Current cars
    should be understood as the comparison fleet - those cars that are selected by the user to bring "forward" in the
    simulation. Then, the user can release vehicles based on end_leasing - if the user decide to release vehicles,
    they should not be present in the fixed_cars array.

    current_cars: the comparison fleet (trips will be pulled based of these)
    fixed_cars: cars that can only be removed in the simulation/optimisation if there's excess capacity in the fleet.
    """
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
    sim_start = datetime.now()
    r = run_goal_simulation.apply_async(args=(simulation_in, sim_start,), task_id=get_task_id("goal_simulation"))
    if os.path.exists("/fleetmanager/running_tasks"):
        with open(f"/fleetmanager/running_tasks/{sim_start}.txt", "w") as f:
            f.write("running")
    return GoalSimulationOut(
        id=r.id,
        status=r.status,
        progress={"progress": 0, "sim_start": sim_start, "task_message": "Igangsætter simulering"},
        result=None
    )


@router.delete("/simulation/{simulation_id}")
async def delete_or_stop_simulation(simulation_id: str):
    # revoking is not supported https://github.com/celery/celery/issues/4019
    r = AsyncResult(simulation_id)
    if r.info is None:
        return {"task_terminating_on_next_iteration": False}
    os.remove(f"/fleetmanager/running_tasks/{r.info['sim_start']}.txt")
    return {"task_terminating_on_next_iteration": True}


@router.get("/simulation/{simulation_id}", response_model=GoalSimulationOut)
async def get_goal_simulation(
        simulation_id: str,
        solution_index: int = None,
        sec_fetch_dest: str = Header(None),
        download: bool = False,
):
    """Get progress of simulation result"""
    r = AsyncResult(simulation_id)
    if r.successful():
        result = r.get()
        if (sec_fetch_dest == "document" or download) and "solutions" in result and solution_index is not None:
            sim_settings = result.get("simulation_options")
            solution_results = result.get("solutions", [])[solution_index].results
            solution_results["simulation_options"] = sim_settings
            stream, _ = simulation_results_to_excel(solution_results)
            headers = {
                "Content-Disposition": f'attachment; filename="automatic_simulation_results_solution{solution_index}_{simulation_id}.xlsx"',
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
            return StreamingResponse(stream, headers=headers)
        progress = {"progress": 1, "sim_start": None, "task_message": None}
    elif r.info is not None:
        result = None
        progress = r.info
    else:
        result = None
        progress = {}
    return GoalSimulationOut(id=r.id, status=r.status, progress=progress, result=result)


@router.get("/simulation-history", response_model=list[GoalSimulationHistory])
async def get_goal_simulation_history(session: Session = Depends(get_session)):
    r = redis.Redis(host="redis", port=6379)
    return load_goal_simulation_history(session, r)
