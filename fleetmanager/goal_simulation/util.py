import os
from datetime import date, datetime
import pickle

import pandas as pd
from sqlalchemy import select

from fleetmanager.api.goal_simulation.schemas import (
    GoalSimulationOptions,
    Solution,
    SolutionVehicle,
    GoalSimulationHistory,
)
from fleetmanager.data_access.dbschema import AllowedStarts
from fleetmanager.fleet_simulation import prepare_trip_store, vehicle_usage
from fleetmanager.model.genetic import AutomaticSimulation, prepared_settings_type, shift_type, bike_settings_type
from fleetmanager.model.tabu import TabuSearch
from fleetmanager.model.vehicle_optimisation import FleetOptimisation
from sqlalchemy.orm import Session
import redis


def goal_simulator(settings: GoalSimulationOptions, task=None, sim_start=None):
    if task is not None and sim_start is not None:
        task.update_state(
            state="PROGRESS",
            meta={"progress": 0, "sim_start": sim_start},
        )
    # ensure setting compatibility
    sim_settings = {
        **settings.settings.simulation_settings.dict(),
        "allowance": dict(
            low=settings.settings.simulation_settings.low,
            high=settings.settings.simulation_settings.high,
        ),
        "location": settings.location_id,
        "dates": [settings.start_date, settings.end_date],
        "active_vehicles": {vehicle: 1 for vehicle in settings.fixed_vehicles},
        "special_selected": settings.test_vehicles,
    }
    bike_slots = [
        (
            datetime.combine(date(2020, 1, 1), slot.bike_start),
            datetime.combine(date(2020, 1, 1), slot.bike_end),
        )
        for slot in settings.settings.bike_settings.bike_slots
    ]

    max_bike_time_slot = max(
        [(end - start).total_seconds() / 3600 for start, end in bike_slots] + [0]
    )
    bike_settings = {
        "max_distance_pr_trip": settings.settings.bike_settings.max_km_pr_trip,
        "allowed_driving_time_slots": bike_slots,
        "max_time_slot": max_bike_time_slot,
        "bike_percentage": settings.settings.bike_settings.percentage_of_trips,  # todo sanity check this all the way through
        "bike_speed": settings.settings.bike_settings.dict().get("bike_speed", 20),
        "electrical_bike_speed": settings.settings.bike_settings.dict().get(
            "electrical_bike_speed", 30
        ),
    }

    shifts = None
    if len(settings.settings.shift_settings) > 0:
        location_shift = [
            shifts.shifts
            for shifts in settings.settings.shift_settings
            if shifts.location_id == settings.location_id or (settings.location_ids and shifts.location_id in settings.location_ids)
        ]
        if location_shift:
            shifts = [
                {
                    "shift_start": shift.shift_start,
                    "shift_end": shift.shift_end,
                    "break": shift.shift_break,
                }
                for shift in location_shift[0]
            ]
            settings.settings.shift_settings = [
                a
                for a in settings.settings.shift_settings
                if a.location_id == settings.location_id
            ]
    sim_settings["shifts"] = shifts
    sim_settings["location"] = [settings.location_id] if settings.location_ids is None or len(settings.location_ids) == 0 else settings.location_ids

    # load class to handle vehicle fleet building during Tabu search
    vehicle_manager = FleetOptimisation(
        sim_settings, km_aar=settings.limit_km, bike_settings=bike_settings
    )

    response = {
        "number_of_trips": 0,
        "solutions": None,
        "simulation_options": settings,
        "message": None,
    }

    # check if there are vehicles in the selected/active
    if len(vehicle_manager.proper) == 0:
        response["message"] = "Input vehicles does not exist in the database"
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    tb = TabuSearch(
        vehicle_manager,
        sim_settings["location"],
        [settings.start_date, settings.end_date],
        co2e_goal=settings.co2e_saving,
        expense_goal=settings.extra_expense,
        weight=settings.prioritisation,
        intelligent=settings.intelligent_allocation,
        km_aar=settings.limit_km,
        use_timeslots=False,
        settings=sim_settings,
        current_vehicles=settings.current_vehicles,
    )

    if tb.total_trips is None:
        response["message"] = "No trips found"
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    response["number_of_trips"] = len(tb.total_trips.trips)
    search_ready = tb.run()

    # workaround for allowing interruption of goal simulation
    if search_ready is False:
        response["message"] = "No cars selected."
        if sim_start is not None and os.path.exists(f"/fleetmanager/running_tasks/{sim_start}.txt"):
            os.remove(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    for a, b in tb.iterate_solutions():
        if task is not None:
            if not os.path.exists(f"/fleetmanager/running_tasks/{sim_start}.txt"):
                response["message"] = "Search aborted."
                return response

            task.update_state(
                state="PROGRESS",
                meta={"progress": 0 if any([a == 0, b == 0]) else a / b, "sim_start": sim_start},
            )

    tb.report = tb.sort_solutions()
    if len(tb.report) == 0:
        response["message"] = "No solutions found"
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    current_expense = tb.cur_result[0]
    current_emission = tb.cur_result[1]

    solutions = []
    for solution in tb.report:
        solutions.append(
            Solution(
                current_expense=current_expense,
                current_co2e=current_emission,
                simulation_expense=solution["omkostning"],
                simulation_co2e=solution["co2e"],
                unallocated=solution["ukørte"],
                vehicles=[
                    SolutionVehicle(
                        id=vehicle["fleet_id"],
                        count=vehicle["count"],
                        name=vehicle["class_name"],
                        omkostning_aar=vehicle["omkostning_aar"],
                        emission=vehicle["stringified_emission"],
                    )
                    for vehicle in solution["flåde"]
                ],
            )
        )

    response["solutions"] = solutions
    delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
    return response


def automatic_simulator(settings: GoalSimulationOptions, task=None, sim_start=None):
    if task is not None and sim_start is not None:
        task.update_state(
            state="PROGRESS",
            meta={"progress": 0, "sim_start": sim_start},
        )
    # ensure setting compatibility
    sim_settings = {
        **settings.settings.simulation_settings.dict(),
        "allowance": dict(
            low=settings.settings.simulation_settings.low,
            high=settings.settings.simulation_settings.high,
        ),
        "location": settings.location_id,
        "dates": [settings.start_date, settings.end_date],
        "active_vehicles": {vehicle: 1 for vehicle in settings.fixed_vehicles},
        "special_selected": settings.test_vehicles,
    }
    bike_slots = [
        (
            datetime.combine(date(2020, 1, 1), slot.bike_start),
            datetime.combine(date(2020, 1, 1), slot.bike_end),
        )
        for slot in settings.settings.bike_settings.bike_slots
    ]

    max_bike_time_slot = max(
        [(end - start).total_seconds() / 3600 for start, end in bike_slots] + [0]
    )
    bike_settings: bike_settings_type = {
        "max_distance_pr_trip": settings.settings.bike_settings.max_km_pr_trip,
        "allowed_driving_time_slots": bike_slots,
        "max_time_slot": max_bike_time_slot,
        "bike_percentage": settings.settings.bike_settings.percentage_of_trips,
        "bike_speed": settings.settings.bike_settings.dict().get("bike_speed", 20),
        "electrical_bike_speed": settings.settings.bike_settings.dict().get(
            "electrical_bike_speed", 30
        ),
    }

    shifts = None
    if len(settings.settings.shift_settings) > 0:
        location_shift = [
            shifts.shifts
            for shifts in settings.settings.shift_settings
            if shifts.location_id == settings.location_id or (settings.location_ids and shifts.location_id in settings.location_ids)
        ]
        if location_shift:
            shifts: list[shift_type] = [
                {
                    "shift_start": shift.shift_start,
                    "shift_end": shift.shift_end,
                    "break": shift.shift_break,
                }
                for shift in location_shift[0]
            ]
            settings.settings.shift_settings = [
                a
                for a in settings.settings.shift_settings
                if a.location_id == settings.location_id or (settings.location_ids and a.location_id in settings.location_ids)
            ]
    sim_settings["shifts"] = shifts
    sim_settings["location"] = [settings.location_id] if settings.location_ids is None or len(settings.location_ids) == 0 else settings.location_ids
    sim_settings["bike_settings"] = bike_settings
    sim_settings["prioritisation"] = settings.prioritisation
    sim_settings["km_aar"] = settings.limit_km
    sim_settings["intelligent_allocation"] = settings.intelligent_allocation
    sim_settings: prepared_settings_type = sim_settings
    response = {
        "number_of_trips": 0,
        "solutions": None,
        "simulation_options": settings,
        "message": None,
    }

    automatic = AutomaticSimulation(
        locations=sim_settings["location"],
        start_date=settings.start_date,
        end_date=settings.end_date,
        fixed_vehicles=settings.fixed_vehicles,
        current_vehicles=settings.current_vehicles,
        test_vehicles=settings.test_vehicles,
        settings=sim_settings
    )
    if not update_progress(task, sim_start, 0.05, response, task_message="Estimerer cykel - og køretøjsbehov"):
        return response

    automatic.prepare_simulation()

    if automatic.th is None or len(automatic.th.trips.all_trips) == 0:
        response["message"] = "No trips found"
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    if automatic.fh is None or len(automatic.fh.fleet) == 0:
        response["message"] = "No cars selected."
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    if not update_progress(task, sim_start, 0.2, response, task_message="Afsøger optimale flådesammensætninger"):
        return response

    for n, x in automatic.run_search():
        step = (1 + n) / (1 + x) * 60 / 100
        if not update_progress(task, sim_start, step + 0.2, response, task_message="Tester løsninger"):
            return response

    for n, x in automatic.run_solutions():
        step = (1 + n) / (1 + x) * 20 / 100
        if not update_progress(task, sim_start, step + 0.8, response, task_message="Evaluerer resultater"):
            return response

    if len(automatic.reports) == 0:
        response["message"] = "No solutions found"
        delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
        return response

    if not update_progress(task, sim_start, 0.99, response, task_message="Sammenligner med nuværende flåde"):
        return response

    current_results = automatic.run_current()

    current_expense = current_results["omkostning"]
    current_emission = current_results["udledning"]
    current_db = current_results["driving_book"]

    current_vehicle_usage = vehicle_usage(current_results["consequence_calculator"].store)

    solutions = []
    for solution in rank_solutions(automatic.reports, settings.prioritisation)[:5]:
        solution_results = solution["results"]
        solution_results["current_vehicle_distribution"] = current_results["results"]["current_vehicle_distribution"]
        usage_report = {
            "simulation": solution_results["vehicle_usage"].get("drivingcheck", {}),
            "current": current_vehicle_usage.get("current")
        }
        solution_results["vehicle_usage"] = usage_report
        db = prepare_auto_trip_store(solution["driving_book"], current_db)
        results = {
            "driving_book": prepare_trip_store(db),
            "results": solution_results
        }
        solutions.append(
            Solution(
                current_expense=current_expense,
                current_co2e=current_emission,
                simulation_expense=solution["omkostning"],
                simulation_co2e=solution["udledning"],
                unallocated=solution["uallokeret"],
                vehicles=[
                    SolutionVehicle(
                        id=vehicle["fleet_id"],
                        count=vehicle["count"],
                        count_difference=vehicle["count_difference"],
                        name=vehicle["class_name"],
                        omkostning_aar=vehicle["omkostning_aar"],
                        emission=vehicle["stringified_emission"],
                    )
                    for vehicle in solution["flåde"]
                ],
                results=results
            )
        )

    response["solutions"] = solutions
    delete_running_file(f"/fleetmanager/running_tasks/{sim_start}.txt")
    return response


def prepare_auto_trip_store(sim: pd.DataFrame, cur: pd.DataFrame, sim_fleet_name: str = "drivingcheck"):
    save = sim.copy()
    save["simulation"] = sim[sim_fleet_name]
    save["current"] = cur["current"]
    return save


def delete_running_file(path):
    if os.path.exists(path):
        os.remove(path)


def load_goal_simulation_history(
    session: Session, redis: redis.Redis
) -> list[GoalSimulationHistory]:
    previous_simulations: list[GoalSimulationHistory] = []
    pattern = f"celery-task-meta-{os.getenv('CELERY_QUEUE')}:goal_simulation:*"
    for key in redis.scan_iter(match=pattern, count=100):
        task = redis.get(key)
        if task is not None:
            unpickled = pickle.loads(task)
            if (
                unpickled.get("status") == "SUCCESS"
            ):
                simulation_options = dict(unpickled.get("result").get("simulation_options"))
                location_id = simulation_options.get("location_id")
                location_ids = None if "location_ids" not in simulation_options else simulation_options.get("location_ids")
                if location_ids:
                    location_address = None
                    location_addresses = " & ".join(
                        map(lambda row: row.address, session.query(AllowedStarts).filter(AllowedStarts.id.in_(location_ids)).all())
                    )
                else:
                    location_addresses = None
                    location_address = session.scalar(
                        select(AllowedStarts.address).filter(
                            AllowedStarts.id == location_id
                        )
                    )
                previous_simulations.append(
                    GoalSimulationHistory(
                        id=unpickled.get("task_id"),
                        start_date=str(
                            unpickled.get("result").get("simulation_options").start_date
                        ),
                        end_date=str(
                            unpickled.get("result").get("simulation_options").end_date
                        ),
                        location=location_address
                        if location_address
                        else "Ingen lokation",
                        locations=location_addresses,
                        simulation_date=unpickled.get("date_done"),
                    )
                )
    return previous_simulations


def rank_solutions(solutions, prioritisation):
    omkostning_weight = (10 - prioritisation) / 10
    udledning_weight = prioritisation / 10

    omkostning_min = min(solution['omkostning'] for solution in solutions)
    omkostning_max = max(solution['omkostning'] for solution in solutions)
    udledning_min = min(solution['udledning'] for solution in solutions)
    udledning_max = max(solution['udledning'] for solution in solutions)

    for solution in solutions:
        omkostning_normalized = (solution['omkostning'] - omkostning_min) / (omkostning_max - omkostning_min)
        udledning_normalized = (solution['udledning'] - udledning_min) / (udledning_max - udledning_min)
        solution['combined_score'] = omkostning_normalized * omkostning_weight + udledning_normalized * udledning_weight

    ranked_solutions = sorted(solutions, key=lambda x: x['combined_score'])

    return ranked_solutions


def update_progress(task, sim_start, progress, response, task_message=None):
    """Helper function to update task progress and check file existence."""
    if task is not None:
        if not os.path.exists(f"/fleetmanager/running_tasks/{sim_start}.txt"):
            response["message"] = "Search aborted."
            return False
        meta = {"progress": progress, "sim_start": sim_start}
        if task_message:
            meta["task_message"] = task_message
        task.update_state(
            state="PROGRESS",
            meta=meta
        )
    return True

