import io
import os
import pickle
from datetime import date, datetime
from typing import List, TypedDict, Dict
import regex as re

import numpy as np
import pandas as pd
import redis
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from fleetmanager.api.fleet_simulation.schemas import (
    FleetSimulationHistory,
    FleetSimulationOptions,
    FleetSimulationResult,
    SimulationHighlight
)
from fleetmanager.api.goal_simulation.schemas import GoalSimulationResult
from fleetmanager.data_access.dbschema import AllowedStarts
from fleetmanager.model.model import Model


datetime_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

single_trip = TypedDict(
    "single_trip",
    {
        "start_time": datetime,
        "end_time": datetime,
        "distance": float,
        "current_vehicle_name": str,
        "current_vehicle_id": str,
        "simulation_vehicle_name": str,
        "simulation_vehicle_id": str,
        "simulation_type": int,
        "current_type": int,
    },
)

simulated_trips = List[single_trip]

distribution_source = TypedDict(
    "distribution_source",
    {
        "Cykel": np.ndarray,
        "El-cykel": np.ndarray,
        "El-bil": np.ndarray,
        "Fossil-bil": np.ndarray,
        "Ikke tildelt": np.ndarray,
        "edges": np.ndarray,
    },
)


def fleet_simulator(settings: FleetSimulationOptions):
    """
    Simulation function. Takes in the simulation options and settings, starts, runs and return the results
    """

    # ensure setting compatibility
    sim_settings = {
        **settings.settings.simulation_settings.dict(),
        "allowance": dict(
            low=settings.settings.simulation_settings.low,
            high=settings.settings.simulation_settings.high,
        ),
    }

    # the boolean settings for the simulation
    intelligent_simulation = settings.intelligent_allocation
    limit_km = settings.limit_km

    # prepare bike settings
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
    bike_percentage = settings.settings.bike_settings.percentage_of_trips
    bike_max_pr_trip = settings.settings.bike_settings.max_km_pr_trip
    # todo fix the settings mess
    # prepare shift settings if any exists
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
    sim_settings["bike_settings"] = settings.settings.bike_settings.dict()
    # simulation setup
    m = Model(
        location=settings.location_id if settings.location_ids is None or len(settings.location_ids) == 0 else settings.location_ids,
        dates=[settings.start_date, settings.end_date],
        settings=sim_settings,
        vehicles=settings.current_vehicles,
    )

    # if no trips exists in the selected period for the selected vehicles
    if len(m.trips.all_trips) == 0:
        return {
            "number_of_trips": 0,
            "unallocated": None,
            "financial_savings": None,
            "co2e_savings": None,
            "simulation_options": settings,
        }

    # set the selected vehicles
    indices = m.fleet_manager.vehicle_factory.all_vehicles
    for vehicle in settings.current_vehicles:
        converted_id = str(indices[indices.id == vehicle].index.values[0])
        setattr(m.fleet_manager.current_fleet, converted_id, 1)
    for vehicle in settings.simulation_vehicles:
        converted_id = str(indices[indices.id == vehicle.id].index.values[0])
        setattr(
            m.fleet_manager.simulation_fleet,
            converted_id,
            0 if pd.isna(vehicle.simulation_count) else vehicle.simulation_count,
        )

    m.run_simulation(
        intelligent_simulation,
        bike_time_slots=bike_slots,
        bike_percentage=bike_percentage,
        bike_max_distance=bike_max_pr_trip,
        max_bike_time_slot=max_bike_time_slot,
        km_aar=limit_km,
        use_timeslots=False,
    )

    unallocated = sum(m.consequence_calculator.capacity_source["sim_unassigned_trips"])
    savings_key = m.consequence_calculator.consequence_table["keys"].index(
        "Samlet omkostning [kr/år]"
    )
    co2e_key = m.consequence_calculator.consequence_table["keys"].index(
        "POGI CO2-ækvivalent udledning [CO2e]"
    )
    savings = round(
        m.consequence_calculator.consequence_table["cur_values"][savings_key]
        - m.consequence_calculator.consequence_table["sim_values"][savings_key],
    )
    co2e_savings = round(
        m.consequence_calculator.consequence_table["cur_values"][co2e_key]
        - m.consequence_calculator.consequence_table["sim_values"][co2e_key],
        3,
    )

    db = prepare_trip_store(m.trips.trips)

    unallocated_pr_day = get_unallocated(db)

    current_ad = allocation_distribution(m.current_hist)
    simulation_ad = allocation_distribution(m.simulation_hist)

    detailed_vehicle_usage = vehicle_usage(m.consequence_calculator.store)

    return {
        "number_of_trips": len(m.trips.all_trips),
        "unallocated": unallocated,
        "financial_savings": savings,
        "co2e_savings": co2e_savings,
        "driving_book": db,
        "simulation_options": settings,
        "results": {
            "unallocated_pr_day": unallocated_pr_day,
            "current_vehicle_distribution": current_ad,
            "simulation_vehicle_distribution": simulation_ad,
            "vehicle_usage": detailed_vehicle_usage,
        },
    }


def prepare_trip_store(trips: pd.DataFrame):
    save = trips[
        [
            "start_time",
            "end_time",
            "distance",
            "current",
            "simulation",
        ]
    ].copy()
    save["current_vehicle_name"] = save.current.apply(
        lambda x: f"{x.make} {x.model} {x.name.split('_')[-1]} {x.__dict__.get('plate', '')}"
        if x.name != "Unassigned"
        else "Ikke allokeret"
    )
    save["current_vehicle_id"] = save.current.apply(
        lambda x: x.id if x.name != "Unassigned" else None
    ).astype(str)

    save["simulation_vehicle_name"] = save.simulation.apply(
        lambda x: f"{x.make} {x.model} {x.name.split('_')[-1]} {x.__dict__.get('plate', '')}"
        if x.name != "Unassigned"
        else "Ikke allokeret"
    )
    save["simulation_vehicle_id"] = save.simulation.apply(
        lambda x: x.id if x.name != "Unassigned" else None
    ).astype(str)
    save["simulation_type"] = save.simulation.apply(
        lambda x: -1 if x.name == "Unassigned" else x.typeid
    )
    save["current_type"] = save.current.apply(
        lambda x: -1 if x.name == "Unassigned" else x.typeid
    )

    save.drop(["current", "simulation"], axis=1, inplace=True)

    trip_store = save.to_dict("records")
    return trip_store


def get_unallocated(driving_book: pd.DataFrame | List[single_trip], fleet_name="simulation"):
    if len(driving_book) == 0:
        return []
    if type(driving_book) != pd.DataFrame:
        driving_book = pd.DataFrame(driving_book)

    r = pd.date_range(
        start=driving_book.start_time.min().date(),
        end=driving_book.end_time.max().date(),
    )
    all_dates = pd.DataFrame({"date": r})

    driving_book = driving_book[driving_book[f"{fleet_name}_type"] == -1].copy()
    driving_book["date"] = driving_book.start_time.apply(lambda x: x.date())
    driving_book = driving_book.groupby("date").count()
    driving_book = (
        driving_book.reset_index()
        .iloc[:, :2]
        .rename({"start_time": "Antal ikke allokeret"}, axis=1)
    )
    driving_book["date"] = driving_book.date.astype("datetime64[ns]")
    driving_book = pd.merge(all_dates, driving_book, on="date", how="left").fillna(0)
    return driving_book.to_dict("records")


def allocation_distribution(source: distribution_source):
    bins = source.pop("edges")
    bins = (0.5 * (bins[:-1] + bins[1:])).tolist()
    categories = []
    for key, value in source.items():
        categories.append({"x": bins, "y": value.tolist(), "name": key})

    return categories


def vehicle_usage(store: Dict):
    """
    Store like:

    {
        "current": [
            [køretøj, allokerede km ... ],
            [køretøj, allokerede km ... ]
        ],
        "simulation": [
            [køretøj, allokerede km ... ],
            [køretøj, allokerede km ... ]
        ],
    }

    with all the values from the below list in "headers".
    """
    frames = {}
    headers = [
        "Køretøj",
        "Allokerede km",
        "Årlig km",
        "WLTP",
        "Udledning for allokeret (kg CO2e)",
        "Årlig udledning (kg CO2e)",
        "Årlig Omkostning kr",
        "Årlig Driftsomkostning kr",
        "Årlig Samfundsøkonomisk Omkostning kr",
        "Samlet Årlig Omkostning kr",
    ]
    for state, rows in store.items():
        frames[state] = pd.DataFrame(rows, columns=headers).to_dict("records")
    return frames


def prepare_settings(settings, shifts=None, bike_settings=None):
    headers = ["Indstilling", "Enhed"]
    rows = [
        ["Udledning, El (kg. CO2e/kWh)", settings["el_udledning"]],
        ["Udledning, Benzin (kg. CO2e/liter)", settings["benzin_udledning"]],
        ["Udledning, Diesel (kg. CO2e/liter)", settings["diesel_udledning"]],
        ["Udledning, HVO (kg. CO2e/liter)", settings["hvo_udledning"]],
        ["", ""],
        ["Pris, El (kr/kWh)", settings["pris_el"]],
        ["Pris, Benzin (kr/liter)", settings["pris_benzin"]],
        ["Pris, Diesel (kr/liter)", settings["pris_diesel"]],
        ["Pris, HVO (kr/liter)", settings["pris_hvo"]],
        ["", ""],
        [
            "Samfundsøkonomisk omkostning (kr/ton CO2e)",
            settings["vaerdisaetning_tons_co2"],
        ],
        ["", ""],
        ["Køretøjsskift, minimum skiftetid (minutter)", settings["sub_time"]],
        ["", ""],
        ["Medarbejder kørepenge, lav takst (kr/km)", settings["low"]],
        ["Medarbejder kørepenge, høj takst (kr/km)", settings["high"]],
        ["Medarbejder takst-grænse (km)", settings["distance_threshold"]],
        ["Medarbejder køretøj, type", settings["undriven_type"]],
        ["Medarbejder køretøj, WLTP", settings["undriven_wltp"]],
    ]
    if shifts is not None and len(shifts) > 0:
        rows.append(["", ""])
        for k, shift in enumerate(shifts):
            pause = (
                ""
                if pd.isna(shift["shift_break"]) or shift["shift_break"] == ""
                else f", Pause: {shift['shift_break']}"
            )
            rows.append(
                [
                    f"Vagthold {k + 1}",
                    f"Start: {shift['shift_start']}, Slut: {shift['shift_end']}"
                    + pause,
                ]
            )
    if bike_settings is not None:
        rows.append(["", ""])
        rows.append(["Cykelindstillinger:", ""])
        rows.append(["Maks. km. pr tur", bike_settings["max_km_pr_trip"]])
        rows.append(
            [
                "Procentvis allokering",
                "100%"
                if pd.isna(bike_settings["percentage_of_trips"])
                else bike_settings["percentage_of_trips"],
            ]
        )

        rows.append(["Maks. km/t for cykel", bike_settings.get("bike_speed", 8)])
        rows.append(["Maks. km/t for elcykel", bike_settings.get("electrical_bike_speed", 12)])

        for k, bike_slot in enumerate(bike_settings["bike_slots"]):
            start = bike_slot["bike_start"]
            end = bike_slot["bike_end"]
            rows.append(
                [f"Tilladt cykel tidsrum {k+1}", f"Start: {start}, Slut: {end}"]
            )

    data = pd.DataFrame(
        rows,
        columns=headers,
    )
    return data


def simulation_results_to_excel(results, session: Session = None):
    output = io.BytesIO()
    writer = pd.ExcelWriter(output, engine="xlsxwriter")

    #################### køreplan sheet #########################
    dbook = pd.DataFrame(results["driving_book"])[
        [
            "start_time",
            "end_time",
            "distance",
            "current_vehicle_name",
            "simulation_vehicle_name",
        ]
    ]
    dbook.rename(
        {
            "start_time": "Start Tidspunkt",
            "end_time": "Slut Tidspunkt",
            "distance": "Distance",
            "current_vehicle_name": "Nuværende Køretøj",
            "simulation_vehicle_name": "Simuleret Køretøjet",
        },
        inplace=True,
        axis=1,
    )
    dbook.to_excel(writer, sheet_name="Køreplan", index=False)
    # autofitting columns
    for col_idx, col in enumerate(dbook):
        column_length = max(dbook[col].astype(str).map(len).max(), len(col))
        writer.sheets["Køreplan"].set_column(col_idx, col_idx, column_length)

    #################### Ikke allokeret ture sheet #########################
    unallocated_pr_day = pd.DataFrame(results["results"]["unallocated_pr_day"])
    unallocated_pr_day.rename({"date": "Dato"}, inplace=True)
    unallocated_pr_day.to_excel(writer, sheet_name="Ikke allokeret ture", index=False)
    # autofitting columns
    for col_idx, col in enumerate(unallocated_pr_day):
        column_length = max(
            unallocated_pr_day[col].astype(str).map(len).max(), len(col)
        )
        writer.sheets["Ikke allokeret ture"].set_column(col_idx, col_idx, column_length)

    #################### allokering sheets #########################
    allocation_distribution_names = {
        "simulation_vehicle_distribution": "Simuleret Allokering",
        "current_vehicle_distribution": "Nuværende Allokering",
    }
    for state, sheet_name in allocation_distribution_names.items():
        ranges = results["results"][state][0]["x"]
        labels = [
            f"{round(a, 2)} km. - {round(b, 2)} km." if len(ranges) > k else f"{b}+ km."
            for k, (a, b) in enumerate(zip([0] + ranges, ranges + [ranges[-1]]))
        ]
        columns = ["Køretøjstype"] + labels
        rows = []

        for vehicle_type in results["results"][state]:
            rows.append([vehicle_type["name"]] + vehicle_type["y"])
        allocation_hist = pd.DataFrame(rows, columns=columns)
        allocation_hist.to_excel(writer, sheet_name=sheet_name, index=False)

        for col_idx, col in enumerate(allocation_hist):
            column_length = max(
                allocation_hist[col].astype(str).map(len).max(), len(col)
            )
            writer.sheets[sheet_name].set_column(col_idx, col_idx, column_length)

    #################### simuleringsindstillinger sheets #########################
    settings = prepare_settings(
        settings=results["simulation_options"].settings.simulation_settings.dict(),
        bike_settings=results["simulation_options"].settings.bike_settings.dict(),
        shifts=(
            results["simulation_options"].settings.shift_settings[0].dict()["shifts"]
            if results["simulation_options"].settings.shift_settings else None
        )
    )
    settings.to_excel(writer, sheet_name="Simuleringsindstillinger", index=False)
    for col_idx, col in enumerate(settings):
        column_length = max(settings[col].astype(str).map(len).max(), len(col))
        writer.sheets["Simuleringsindstillinger"].set_column(
            col_idx, col_idx, column_length
        )

    #################### køretøjsdetaljer sheets #########################
    vehicle_details_names = {
        "simulation": "Simulerede Køretøjsdetaljer",
        "current": "Nuværende Køretøjsdetaljer",
    }
    for state, sheet_name in vehicle_details_names.items():
        usage = pd.DataFrame(results["results"]["vehicle_usage"][state])
        usage.to_excel(writer, sheet_name=sheet_name, index=False)

        for col_idx, col in enumerate(usage):
            column_length = max(usage[col].astype(str).map(len).max(), len(col))
            writer.sheets[sheet_name].set_column(col_idx, col_idx, column_length)

    writer.close()
    output.seek(0)

    location = None
    if session:
        location = (
            session.query(AllowedStarts.address)
            .filter(
                or_(
                    AllowedStarts.id == results["simulation_options"].location_id,
                    AllowedStarts.id.in_(
                        results["simulation_options"].location_ids if results["simulation_options"].location_ids else []
                    )
                )
            )
            .first()
        )
    location = None if location is None else location[0]
    return output, location


def load_fleet_simulation_history(
    session: Session, redis: redis.Redis
) -> list[FleetSimulationHistory]:
    pattern = f"celery-task-meta-{os.getenv('CELERY_QUEUE')}:fleet_simulation:*"
    previous_simulations: list[FleetSimulationHistory] = []
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
                        map(lambda row: row.address, session.query(
                            AllowedStarts).filter(
                                AllowedStarts.id.in_(location_ids)
                            ).all())
                        )
                else:
                    location_addresses = None
                    location_address = session.scalar(
                        select(AllowedStarts.address).filter(
                            AllowedStarts.id == location_id
                        )
                    )
                previous_simulations.append(
                    FleetSimulationHistory(
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


def get_datetime_from_key(key: str) -> datetime:
    task_date = datetime_regex.search(key)
    return datetime.fromisoformat(task_date.group()) if task_date else datetime.fromtimestamp(0)


def get_fleet_simulation_highlights(simulation):
    unparsed_simulation_results = simulation.get("result")
    if unparsed_simulation_results is None:
        return None
    simulation_results = FleetSimulationResult.parse_obj(unparsed_simulation_results)
    simulation_options: FleetSimulationOptions = simulation.get("result", {}).get("simulation_options")

    results = {
        "unallocated": simulation_results.unallocated,
        "fleet_change": sum(
            map(
                lambda sim_vehicle_type: sim_vehicle_type.simulation_count,
                simulation_options.simulation_vehicles
            )
        ) - len(simulation_options.current_vehicles),
        "financial_savings": simulation_results.financial_savings,
        "co2e_savings": simulation_results.co2e_savings,
        "location_ids": simulation_options.location_ids,
        "simulation_type": "fleet"
    }

    return results


def get_goal_simulation_highlights(simulation):
    goal_results = GoalSimulationResult(**simulation.get("result", {}))
    if len(goal_results.solutions) == 0:
        return None
    best_solution = goal_results.solutions[0]  # a goal simulation highlight only returns the first best ranked solution
    results = {
        "unallocated": best_solution.unallocated,
        "fleet_change": sum(map(lambda vehicle_set: vehicle_set.count_difference, best_solution.vehicles)),
        "financial_savings": best_solution.current_expense - best_solution.simulation_expense,
        "co2e_savings": best_solution.current_co2e - best_solution.simulation_co2e,
        "location_ids": goal_results.simulation_options.location_ids,
        "simulation_type": "goal"
    }
    return results


def load_simulation_highlights(r: redis.Redis, session: Session, n: int = 5) -> list[SimulationHighlight]:
    """
    Function to load both fleet - and goal simulation highlights for displaying on the landing page.
    Sorts by date to return the n recent simulations. Session is only used to pull the address name of locations

    r: redis client
    session: db session
    n: number of simulation to take highlights from
    """
    pattern = f"celery-task-meta-{os.getenv('CELERY_QUEUE', 'default')}:*simulation*"
    simulations = [
        (get_datetime_from_key(sim_key.decode()), sim_key.decode())
        for sim_key in r.scan_iter(pattern, count=100)
    ]
    simulations.sort(reverse=True)
    simulation_highlights = []
    for sim_date, key in simulations:
        task_result = r.get(key)
        if not task_result:
            continue
        simulation = pickle.loads(task_result)
        if simulation.get("status") != "SUCCESS":
            continue

        sim_highlight = {}
        if "fleet_simulation" in key:
            sim_highlight = get_fleet_simulation_highlights(simulation)
        elif "goal_simulation" in key:
            sim_highlight = get_goal_simulation_highlights(simulation)
        if not sim_highlight:
            continue
        sim_highlight["addresses"] = [
            location.address for location in session.query(
                AllowedStarts.address
            ).filter(
                AllowedStarts.id.in_(sim_highlight["location_ids"])
            )
        ]
        sim_highlight["id"] = key
        sim_highlight["simulation_date"] = sim_date.isoformat()
        simulation_highlights.append(SimulationHighlight(**sim_highlight))

        if n == len(simulation_highlights):
            break

    return simulation_highlights
