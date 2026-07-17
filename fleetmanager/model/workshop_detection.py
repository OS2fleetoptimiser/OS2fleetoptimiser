"""
Detection of workshop visits from vehicle trips.

A workshop visit is a period where a vehicle sits within the radius of a
registered workshop for longer than a configurable threshold. Detection runs on
the same trips that feed the roundtrip aggregation: the dwell between two
consecutive trips locates the vehicle at the end position of the first trip. If
that position is within a workshop radius and the dwell is long enough, it is a
visit. Consecutive dwells at the same workshop separated by a trivial move are
merged into a single visit.
"""
import os

import pandas as pd
from sqlalchemy import select

from fleetmanager.data_access import SimulationSettings, Workshops, WorkshopVisits
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import calc_distance

logger = logging.getLogger(__name__)

DEFAULT_WORKSHOP_RADIUS_KM = 0.2
DEFAULT_MIN_VISIT_HOURS = 4.0


def get_workshops(session) -> list[dict]:
    return [
        {"id": w.id, "latitude": w.latitude, "longitude": w.longitude}
        for w in session.query(Workshops).all()
        if w.latitude is not None and w.longitude is not None
    ]


def get_visit_min_hours(session) -> float:
    setting = session.scalar(
        select(SimulationSettings).where(
            SimulationSettings.name == "workshop_visit_min_hours"
        )
    )
    if setting is None:
        return DEFAULT_MIN_VISIT_HOURS
    try:
        return float(setting.value)
    except (TypeError, ValueError):
        return DEFAULT_MIN_VISIT_HOURS


def _closest_workshop(workshops: list[dict], coordinate: tuple[float, float]):
    best_id, best_distance = None, float("inf")
    for workshop in workshops:
        distance = calc_distance(
            (workshop["latitude"], workshop["longitude"]), coordinate
        )
        if distance < best_distance:
            best_id, best_distance = workshop["id"], distance
    return best_id, best_distance


def detect_workshop_visits(
    car_trips: pd.DataFrame,
    workshops: list[dict],
    radius_km: float,
    min_hours: float,
) -> list[dict]:
    """
    Return the workshop visits found in a single car's trips. Each visit is a
    dict with workshop_id, start_time, end_time and duration (hours).
    """
    if not workshops or car_trips is None or len(car_trips) < 2:
        return []

    trips = car_trips.sort_values("start_time").reset_index(drop=True)

    # a "dwell" is the stationary period after trip i, located at trip i's end
    dwells = []
    for i in range(len(trips) - 1):
        current, following = trips.iloc[i], trips.iloc[i + 1]
        end_lat, end_lon = current["end_latitude"], current["end_longitude"]
        if pd.isna(end_lat) or pd.isna(end_lon):
            continue
        workshop_id, distance = _closest_workshop(workshops, (end_lat, end_lon))
        if workshop_id is None or distance > radius_km:
            continue
        dwells.append(
            {
                "workshop_id": workshop_id,
                "start_time": current["end_time"],
                "end_time": following["start_time"],
                "trip_distance": following["distance"],
            }
        )

    return _merge_and_threshold(dwells, radius_km, min_hours)


def _merge_and_threshold(
    dwells: list[dict], radius_km: float, min_hours: float
) -> list[dict]:
    """
    Merge consecutive dwells at the same workshop when the trip separating them
    is a trivial move (distance within the radius), then keep only spans that
    are at least min_hours long.
    """
    visits = []
    for dwell in dwells:
        if visits:
            previous = visits[-1]
            trivial_move = (
                previous["trip_distance"] is not None
                and previous["trip_distance"] <= radius_km
            )
            if dwell["workshop_id"] == previous["workshop_id"] and trivial_move:
                previous["end_time"] = dwell["end_time"]
                previous["trip_distance"] = dwell["trip_distance"]
                continue
        visits.append(dict(dwell))

    result = []
    for visit in visits:
        duration = (visit["end_time"] - visit["start_time"]).total_seconds() / 3600
        if duration >= min_hours:
            result.append(
                {
                    "workshop_id": visit["workshop_id"],
                    "start_time": visit["start_time"],
                    "end_time": visit["end_time"],
                    "duration": duration,
                }
            )
    return result


def commit_workshop_visits(session, car_id: int, visits: list[dict]) -> int:
    """
    Persist detected visits, skipping ones that already exist. A detection that
    overlaps an existing visit extends it to the union of the two (a visit seen
    again in a wider reload window may have grown). Returns the number inserted.
    """
    inserted = 0
    for visit in visits:
        existing = (
            session.query(WorkshopVisits)
            .filter(
                WorkshopVisits.car_id == car_id,
                WorkshopVisits.workshop_id == visit["workshop_id"],
                WorkshopVisits.start_time <= visit["end_time"],
                WorkshopVisits.end_time >= visit["start_time"],
            )
            .first()
        )
        if existing:
            new_start = min(existing.start_time, visit["start_time"])
            new_end = max(existing.end_time, visit["end_time"])
            if new_start != existing.start_time or new_end != existing.end_time:
                existing.start_time = new_start
                existing.end_time = new_end
                existing.duration = (new_end - new_start).total_seconds() / 3600
            continue
        session.add(
            WorkshopVisits(
                car_id=car_id,
                workshop_id=visit["workshop_id"],
                start_time=visit["start_time"],
                end_time=visit["end_time"],
                duration=visit["duration"],
            )
        )
        inserted += 1
    return inserted


def process_car_workshop_visits(
    session,
    car_id: int,
    car_trips: pd.DataFrame,
    workshops: list[dict] | None = None,
    radius_km: float | None = None,
    min_hours: float | None = None,
) -> int:
    """Detect and persist workshop visits for one car. Returns the number inserted."""
    if workshops is None:
        workshops = get_workshops(session)
    if not workshops:
        return 0
    if radius_km is None:
        radius_km = float(
            os.getenv("WORKSHOP_RADIUS_KM", DEFAULT_WORKSHOP_RADIUS_KM)
        )
    if min_hours is None:
        min_hours = get_visit_min_hours(session)

    visits = detect_workshop_visits(car_trips, workshops, radius_km, min_hours)
    return commit_workshop_visits(session, car_id, visits)
