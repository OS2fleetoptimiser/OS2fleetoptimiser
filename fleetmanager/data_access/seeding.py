from __future__ import annotations

from datetime import datetime, timedelta
import random
from typing import Optional

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import sessionmaker

from fleetmanager.data_access.dbschema import (
    AllowedStarts,
    Cars,
    FuelTypes,
    LeasingTypes,
    RoundTripSegments,
    RoundTrips,
    VehicleTypes,
    vehicle_type_to_fuel,
)

# calibrated to real fleet data: median ~7.4 km / 52 min ≈ 0.14 km/min for cars.
_BASE_SPEED = {1: 0.12, 2: 0.20, 3: 0.30, 4: 0.25}

departments = ["Hjemmepleje", "Teknik og Miljø"]
forvaltninger = ["Social og Sundhed", "Teknik og Miljø"]

fleet_spec = [
    {"id": 0, "type": 3, "make": "VW", "model": "e-Golf", "trips_per_day": 7, "km_aar": 22000.0,
     "omkostning_aar": 61000.0, "wltp_el": 220, "wltp_fossil": None, "test_vehicle": False, "has_location": True},
    {"id": 1, "type": 3, "make": "Renault", "model": "Zoe", "trips_per_day": 2, "km_aar": 22000.0,
     "omkostning_aar": 61000.0, "wltp_el": 185, "wltp_fossil": None, "test_vehicle": False, "has_location": True},
    {"id": 2, "type": 4, "make": "Toyota", "model": "Yaris", "trips_per_day": 7, "km_aar": 18000.0,
     "omkostning_aar": 47000.0, "wltp_el": None, "wltp_fossil": 20.2, "test_vehicle": False, "has_location": True},
    {"id": 3, "type": 4, "make": "Skoda", "model": "Octavia", "trips_per_day": 2, "km_aar": 18000.0,
     "omkostning_aar": 47000.0, "wltp_el": None, "wltp_fossil": 19.8, "test_vehicle": False, "has_location": True},
    {"id": 4, "type": 1, "make": "Principia", "model": "Citybike", "trips_per_day": 0, "km_aar": 3000.0,
     "omkostning_aar": 2000.0, "wltp_el": None, "wltp_fossil": None, "test_vehicle": True, "has_location": False},
    {"id": 5, "type": 3, "make": "Hyundai", "model": "Kona", "trips_per_day": 0, "km_aar": 22000.0,
     "omkostning_aar": 61000.0, "wltp_el": 190, "wltp_fossil": None, "test_vehicle": True, "has_location": False},
    {"id": 6, "type": 3, "make": "Renault", "model": "Zoe", "trips_per_day": 0, "km_aar": 22000.0,
     "omkostning_aar": 61000.0, "wltp_el": 185, "wltp_fossil": None, "test_vehicle": False,
     "has_location": True},
]

def km_per_minute(car_type_id: int) -> float:
    base = _BASE_SPEED.get(car_type_id, 0.25)
    return base * random.uniform(0.85, 1.15)


def seed_allowed_starts(engine) -> None:
    Session = sessionmaker(bind=engine)

    with Session.begin() as s:
        existing_starts = s.execute(select(AllowedStarts).limit(1)).scalars().first()
        if existing_starts:
            return

        starts = [
            AllowedStarts(address="vej 1", latitude=0.0, longitude=0.0),
            AllowedStarts(address="vej 2", latitude=0.0, longitude=0.0),
            AllowedStarts(address="vej 3", latitude=0.0, longitude=0.0),
        ]

        s.add_all(starts)
        s.flush()


def seed_cars(
    engine,
    *,
    now: Optional[datetime] = None,
) -> None:
    now = now or datetime.now()
    Session = sessionmaker(bind=engine)

    with Session.begin() as s:
        location_ids = (
            s.execute(select(AllowedStarts.id).order_by(AllowedStarts.id.asc()))
            .scalars()
            .all()
        )
        if not location_ids:
            return

        vehicle_types = (
            s.execute(select(VehicleTypes).order_by(VehicleTypes.id.asc()))
            .scalars()
            .all()
        )
        if not vehicle_types:
            return

        fuel_by_id = {
            ft.id: ft
            for ft in s.execute(select(FuelTypes)).scalars().all()
        }
        if not fuel_by_id:
            return

        leasing_type_id = (
            s.execute(select(LeasingTypes.id).order_by(LeasingTypes.id.asc()))
            .scalars()
            .first()
        )

        start_leasing = (now - timedelta(days=180)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end_leasing = (now + timedelta(days=365)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        vt_by_id = {vt.id: vt for vt in vehicle_types}
        leasing_obj = s.get(LeasingTypes, leasing_type_id)

        cars = []
        for i, spec in enumerate(fleet_spec):
            vt = vt_by_id.get(spec["type"])
            if vt is None:
                continue

            allowed_fuels = vehicle_type_to_fuel.get(spec["type"], [])
            fuel_type_id = next((fid for fid in allowed_fuels if fid in fuel_by_id), None)
            if fuel_type_id is None:
                continue

            location_id = location_ids[i % len(location_ids)] if spec["has_location"] else None
            location_obj = s.get(AllowedStarts, location_id) if location_id is not None else None

            cars.append(
                Cars(
                    id=spec["id"],
                    imei=f"IMEI-{spec['id']+1:04d}",
                    plate=f"{spec['id']+1:03d}",
                    make=spec["make"],
                    model=spec["model"],
                    type=spec["type"],
                    type_obj=vt,
                    fuel=fuel_type_id,
                    fuel_obj=fuel_by_id[fuel_type_id],
                    leasing_type=leasing_type_id,
                    location=location_id,
                    start_leasing=start_leasing,
                    end_leasing=end_leasing,
                    km_aar=spec["km_aar"],
                    department=departments[i % len(departments)],
                    deleted=False,
                    disabled=False,
                    test_vehicle=spec["test_vehicle"],
                    location_obj=location_obj,
                    leasing_type_obj=leasing_obj,
                    wltp_el=spec["wltp_el"],
                    wltp_fossil=spec["wltp_fossil"],
                    forvaltning=forvaltninger[i % len(forvaltninger)],
                    omkostning_aar=spec["omkostning_aar"],
                )
            )

        s.add_all(cars)


def seed_dynamic_roundtrips_and_segments(
    engine,
    *,
    now: Optional[datetime] = None,
    days_back: int = 14,
) -> None:
    now = now or datetime.now()
    window_start = now - timedelta(days=days_back)
    Session = sessionmaker(bind=engine)

    # max distance per vehicle type
    _max_dist = {3: 90, 4: 90}

    with Session() as s:
        cars = s.execute(select(Cars.id, Cars.location)).all()
        cars = {cid: loc for cid, loc in cars if cid is not None}
        if not cars:
            return

        latest_end = (
            s.execute(select(RoundTrips.end_time).order_by(RoundTrips.end_time.desc()))
            .scalars()
            .first()
        )
        if latest_end and latest_end > (now - timedelta(days=3)):
            return

        seeded_ids = (
            s.execute(select(RoundTrips.id).where(RoundTrips.aggregation_type == "complete"))
            .scalars()
            .all()
        )
        if seeded_ids:
            s.execute(
                delete(RoundTripSegments).where(
                    RoundTripSegments.round_trip_id.in_(seeded_ids)
                )
            )
            s.execute(delete(RoundTrips).where(RoundTrips.id.in_(seeded_ids)))
            s.commit()

        for car in fleet_spec:
            trips_per_day = car.get("trips_per_day")
            if trips_per_day == 0:
                continue
            car_type = car.get("type")
            car_id = car.get("id")
            max_dist = _max_dist.get(car_type, 90)
            start_location_id = cars.get(car_id)

            for day_offset in range(days_back):
                day = (window_start + timedelta(days=day_offset)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                cursor = day

                specs = []
                for _ in range(trips_per_day):
                    is_night = random.random() < 0.3
                    if is_night:
                        hour = random.randint(18, 23) if random.random() < 0.6 else random.randint(0, 6)
                    else:
                        hour = random.randint(7, 16)
                    specs.append((hour, random.randint(0, 59), random.randint(0, 59), is_night))

                specs.sort(key=lambda x: (x[0] if x[0] >= 7 else x[0] + 24, x[1], x[2]))

                for hour, minute, second, is_night in specs:
                    start = day.replace(hour=hour, minute=minute, second=second)

                    if start < cursor:
                        start = cursor + timedelta(minutes=random.randint(5, 20))

                    if is_night and random.random() < 0.4:
                        distance = random.uniform(25, 90)
                    else:
                        distance = random.lognormvariate(2.0, 0.85)
                        distance = max(0.3, min(distance, max_dist))

                    speed = km_per_minute(car_type)
                    duration_min = (distance / speed) * random.uniform(0.9, 1.15)
                    duration = timedelta(minutes=duration_min)
                    end = start + duration
                    cursor = end + timedelta(minutes=random.randint(3, 15))

                    seg_count = max(1, round(duration_min / 15))

                    res = s.execute(
                        insert(RoundTrips).values(
                            car_id=car_id,
                            start_time=start,
                            end_time=end,
                            start_latitude=0.0,
                            start_longitude=0.0,
                            end_latitude=0.0,
                            end_longitude=0.0,
                            distance=round(distance, 3),
                            aggregation_type="complete",
                            start_location_id=start_location_id,
                        )
                    )
                    rt_id = res.inserted_primary_key[0]

                    seg_len = duration / seg_count
                    seg_start = start
                    for seg_idx in range(seg_count):
                        seg_end = end if seg_idx == seg_count - 1 else (seg_start + seg_len)
                        s.execute(
                            insert(RoundTripSegments).values(
                                round_trip_id=rt_id,
                                start_time=seg_start,
                                end_time=seg_end,
                                distance=round(distance / seg_count, 3),
                            )
                        )
                        seg_start = seg_end

        s.commit()


def seed_db(engine):
    seed_allowed_starts(engine)
    seed_cars(engine)
    seed_dynamic_roundtrips_and_segments(engine)
