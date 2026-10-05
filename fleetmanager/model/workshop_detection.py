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
import atexit
import os

import pandas as pd
from sqlalchemy import select

from fleetmanager.data_access import SimulationSettings, Workshops, WorkshopVisits
from fleetmanager.logging import logging
from fleetmanager.model.roundtripaggregator import calc_distance

logger = logging.getLogger(__name__)

DEFAULT_WORKSHOP_RADIUS_KM = 0.2
DEFAULT_MIN_VISIT_HOURS = 4.0
# how far a vehicle may be driven between two dwells at the same workshop for the
# move to count as repositioning rather than a trip away. Deliberately separate
# from the radius: "how close counts as being at the workshop" and "how short a
# move is trivial" are independent decisions
DEFAULT_TRIVIAL_MOVE_KM = 1.0


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
    trivial_move_km: float = DEFAULT_TRIVIAL_MOVE_KM,
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

    return _merge_and_threshold(dwells, trivial_move_km, min_hours)


def _merge_and_threshold(
    dwells: list[dict], trivial_move_km: float, min_hours: float
) -> list[dict]:
    """
    Merge consecutive dwells at the same workshop when the trip separating them
    is a trivial move (driven distance within trivial_move_km), then keep only
    spans that are at least min_hours long. The driven distance is what tells a
    repositioning within the yard from a trip away and back: both leave the
    vehicle within the radius, so the positions alone cannot separate them.
    """
    visits = []
    for dwell in dwells:
        if visits:
            previous = visits[-1]
            distance_between = previous["trip_distance"]
            trivial_move = (
                distance_between is not None
                and not pd.isna(distance_between)
                and distance_between <= trivial_move_km
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
    trivial_move_km: float | None = None,
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
    if trivial_move_km is None:
        trivial_move_km = float(
            os.getenv("WORKSHOP_TRIVIAL_MOVE_KM", DEFAULT_TRIVIAL_MOVE_KM)
        )

    visits = detect_workshop_visits(
        car_trips, workshops, radius_km, min_hours, trivial_move_km
    )
    return commit_workshop_visits(session, car_id, visits)


class DetectionStats:
    """
    Counts detection outcomes over a run so it can be reported in one line. A
    per-car warning is easy to miss; "failed for 34 of 34 cars" is not.
    """

    def __init__(self):
        self.attempted = 0
        self.failed = 0

    def reset(self):
        self.attempted = 0
        self.failed = 0

    def summary(self) -> str | None:
        if self.attempted == 0:
            return None
        if self.failed == 0:
            return f"Workshop detection ran for {self.attempted} cars"
        return (
            f"Workshop detection failed for {self.failed} of {self.attempted} cars"
        )


detection_stats = DetectionStats()


def log_detection_summary():
    """Log one summary line for the run, then reset. Also runs at process exit."""
    message = detection_stats.summary()
    if message is None:
        return
    if detection_stats.failed:
        logger.error(message)
    else:
        logger.info(message)
    detection_stats.reset()


# the extractors are one-shot cli commands, so process exit is the end of a run.
# this keeps the summary a single integration point instead of six wirings
atexit.register(log_detection_summary)


def run_workshop_detection(
    session_or_maker,
    is_session_maker: bool,
    car_id: int,
    car_trips: pd.DataFrame,
) -> int:
    """
    Detect and persist workshop visits for one car without ever raising, so a
    failure here cannot affect the roundtrip aggregation that follows. Works with
    both a sessionmaker and a plain Session; only the former can open its own
    transaction, the latter shares the extractor's session and is committed here
    because nothing else is guaranteed to commit it.
    """
    detection_stats.attempted += 1
    try:
        if is_session_maker:
            with session_or_maker.begin() as session:
                return process_car_workshop_visits(session, car_id, car_trips)

        inserted = process_car_workshop_visits(session_or_maker, car_id, car_trips)
        session_or_maker.commit()
        return inserted
    except Exception as error:
        detection_stats.failed += 1
        logger.warning(f"Workshop visit detection failed for car {car_id}: {error}")
        if not is_session_maker:
            # a session left in a failed state would break the aggregation below
            try:
                session_or_maker.rollback()
            except Exception as rollback_error:
                logger.warning(
                    f"Could not roll back after workshop detection failure for car "
                    f"{car_id}: {rollback_error}"
                )
        return 0
