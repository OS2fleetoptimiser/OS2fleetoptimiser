from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from fleetmanager.model.roundtripaggregator import aggregator, calc_distance

homes = [
    {"id": 1, "latitude": 56.15, "longitude": 10.20},
    {"id": 2, "latitude": 56.30, "longitude": 10.45},
]
car = {"id": 7, "location": 1}
trip_duration = timedelta(days=7)


def make_trips(seed: int, days: int = 60) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    trips = []
    home = homes[0]
    position = (home["latitude"], home["longitude"])

    def drive(to, start):
        nonlocal position
        if trips:
            start = max(start, trips[-1]["end_time"] + timedelta(minutes=20))
        distance = calc_distance(position, to) * 1.3 + 0.5
        end = start + timedelta(minutes=max(5, distance * 1.2))
        trips.append(
            {
                "id": len(trips) + 1,
                "start_time": start,
                "end_time": end,
                "start_latitude": position[0],
                "start_longitude": position[1],
                "end_latitude": to[0],
                "end_longitude": to[1],
                "distance": distance,
            }
        )
        position = to
        return end

    def away():
        return (
            position[0] + rng.uniform(-0.15, 0.15),
            position[1] + rng.uniform(-0.15, 0.15),
        )

    day = 0
    while day < days:
        kind = rng.random()
        start = datetime(2026, 1, 1, 7) + timedelta(days=day, minutes=int(rng.integers(0, 120)))
        home_point = (home["latitude"], home["longitude"])
        if kind < 0.6:
            for _ in range(rng.integers(1, 4)):
                start = drive(away(), start) + timedelta(minutes=int(rng.integers(20, 180)))
            drive(home_point, start)
            day += 1
        elif kind < 0.75:
            span = int(rng.integers(2, 5))
            for offset in range(span):
                for _ in range(rng.integers(1, 3)):
                    start = drive(away(), start) + timedelta(minutes=int(rng.integers(30, 240)))
                start = datetime(2026, 1, 1, 8) + timedelta(days=day + offset + 1)
            drive(home_point, start)
            day += span
        elif kind < 0.82:
            home = homes[1] if home is homes[0] else homes[0]
            drive((home["latitude"], home["longitude"]), start)
            day += 1
        elif kind < 0.88:
            for offset in range(9):
                drive(away(), datetime(2026, 1, 1, 9) + timedelta(days=day + offset))
            drive(home_point, datetime(2026, 1, 1, 9) + timedelta(days=day + 9))
            day += 10
        else:
            day += 1
    return pd.DataFrame(trips)


def aggregate(trips: pd.DataFrame) -> list[dict]:
    return aggregator(
        car,
        trips.copy().reset_index(drop=True),
        homes,
        allowed_trip_duration=trip_duration,
        home_criteria=0.2,
    )


def aggregate_incrementally(trips: pd.DataFrame, step: timedelta) -> list[dict]:
    saved, last_end = [], None
    cut = trips.start_time.min()
    while cut < trips.end_time.max():
        cut = min(cut + step, trips.end_time.max())
        window = trips[trips.end_time <= cut]
        if last_end is not None:
            window = window[window.start_time > last_end]
        saved += aggregate(window)
        if saved:
            last_end = max(roundtrip["end_time"] for roundtrip in saved)
    return saved


def complete_ratio(roundtrips: list[dict], before: datetime) -> float:
    roundtrips = [roundtrip for roundtrip in roundtrips if roundtrip["end_time"] < before]
    complete = sum(r["distance"] for r in roundtrips if "complete" in r["aggregation_type"])
    return complete / sum(r["distance"] for r in roundtrips)


def trip(trip_id, start, minutes, frm, to):
    return {
        "id": trip_id,
        "start_time": start,
        "end_time": start + timedelta(minutes=minutes),
        "start_latitude": frm[0],
        "start_longitude": frm[1],
        "end_latitude": to[0],
        "end_longitude": to[1],
        "distance": calc_distance(frm, to),
    }


def test_force_end_does_not_leak_into_next_roundtrip():
    home = (homes[1]["latitude"], homes[1]["longitude"])
    a, b, c, d = (56.17, 10.50), (56.28, 10.42), (56.20, 10.30), (56.25, 10.60)
    day = datetime(2026, 1, 6)
    trips = pd.DataFrame(
        [
            trip(1, day.replace(hour=7), 30, home, a),
            trip(2, day.replace(hour=8), 30, a, home),
            trip(3, day.replace(hour=9), 30, home, b),
            trip(4, day.replace(hour=11), 30, b, c),
            trip(5, day.replace(hour=13), 30, c, home),
            trip(6, day.replace(hour=15), 30, home, d),
        ]
    )
    roundtrips = aggregator({"id": 7, "location": 2}, trips, homes, home_criteria=0.2)

    assert [(r["ids"], r["aggregation_type"]) for r in roundtrips] == [
        ([1, 2], "complete"),
        ([3, 4, 5], "complete"),
    ]


@pytest.mark.parametrize("seed", range(4))
def test_no_open_roundtrips_saved_at_the_end(seed):
    trips = make_trips(seed)
    for cut in pd.date_range(trips.start_time.min() + timedelta(days=3), trips.end_time.max(), freq="2D"):
        window = trips[trips.end_time <= cut]
        roundtrips = aggregate(window)
        if not roundtrips:
            continue
        completable_after = window.end_time.max() - trip_duration
        last = roundtrips[-1]
        assert "complete" in last["aggregation_type"] or last["start_time"] <= completable_after, (
            f"open {last['aggregation_type']} roundtrip {last['ids']} was saved at the end of the window"
        )


@pytest.mark.parametrize("seed", range(6))
def test_incremental_runs_match_a_single_run(seed):
    trips = make_trips(seed)
    settled = trips.end_time.max() - trip_duration

    single = complete_ratio(aggregate(trips), settled)
    incremental = complete_ratio(aggregate_incrementally(trips, timedelta(hours=24)), settled)

    assert incremental == pytest.approx(single, abs=0.05)
