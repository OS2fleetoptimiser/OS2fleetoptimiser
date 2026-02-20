from __future__ import annotations

from datetime import datetime, timedelta, timezone
import random
from typing import Optional

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import sessionmaker

from fleetmanager.data_access.dbschema import (
    AllowedStarts,
    AllowedStartAdditions,
    Cars,
    FuelTypes,
    LeasingTypes,
    RoundTripSegments,
    RoundTrips,
    VehicleTypes,
    vehicle_type_to_fuel,
    vehicle_type_to_wltp,
)
def km_per_minute(car_type_id: int) -> float:
    base = {1: 0.25, 2: 0.35, 3: 0.50, 4: 0.45}.get(car_type_id, 0.45)
    return base * random.uniform(0.85, 1.15)

def seed_allowed_starts(engine) -> None:
    Session = sessionmaker(bind=engine)

    with Session.begin() as s:
        existing_starts = s.execute(select(AllowedStarts).limit(1)).scalars().first()
        if existing_starts:       
            existing_addition = (
                s.execute(select(AllowedStartAdditions.id).limit(1)).scalars().first()
            )
            if existing_addition:
                return

            all_starts = s.execute(select(AllowedStarts)).scalars().all()
            additions = []
            for st in all_starts:
                lat = float(st.latitude or 0.0)
                lon = float(st.longitude or 0.0)
                additions.append(
                    AllowedStartAdditions(
                        allowed_start=st,  
                        longitude=lon,
                        addition_date=datetime.now(timezone.utc),

                    )
                )
            s.add_all(additions)
            return

        starts = [
            AllowedStarts(
                address="vej 1",
                latitude=56.1629,
                longitude=10.2039,
            ),
            AllowedStarts(
                address="vej 2",
                latitude=56.1600,
                longitude=10.2100,
            ),
            AllowedStarts(
                address="vej 3",
                latitude=56.1700,
                longitude=10.1900,
            ),
        ]

        s.add_all(starts)
        s.flush()  

        additions = []
        for st in starts:
            lat = float(st.latitude or 0.0)
            lon = float(st.longitude or 0.0)
            additions.append(
                AllowedStartAdditions(
                    allowed_start=st, 
                    latitude=lat,
                    longitude=lon,
                    addition_date=datetime.now(timezone.utc),

                )
            )

        s.add_all(additions)

def seed_cars(
    engine,
    *,
    now: Optional[datetime] = None,
    num_cars: int = 8,
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
        s.execute(
        select(VehicleTypes)
        .order_by(VehicleTypes.id.asc())
         )
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

        models_by_type = {
    1: [("Principia", "Citybike")],          
    2: [("Gazelle", "E-bike")],              
    3: [("VW", "e-Golf"), ("Renault", "Zoe"), ("Hyundai", "Kona")],   
    4: [("Toyota", "Yaris"), ("Skoda", "Octavia")],               
}


        departments = [
            "Hjemmepleje",
            "Administration",
            "Teknik og Miljø",
        ]

    
        forvaltninger = [
            "Social og Sundhed",
            "Børn og Unge",
            "Teknik og Miljø",
            "Kultur og Fritid",
            "Økonomi og HR",
        ]

        omkostning_aar_values = [2000, 10000, 61000.0, 47000.0]
     
        el_idx = 0
        fossil_idx = 0

        cars = []
        for i in range(num_cars):
            vt = vehicle_types[i % len(vehicle_types)]
            vehicle_type_id = vt.id

            pool = models_by_type.get(vehicle_type_id)
            if not pool:
                continue

            make, model = pool[i % len(pool)]
            department = departments[i % len(departments)]
            location_id = location_ids[i % len(location_ids)]
            location_obj = s.get(AllowedStarts, location_id)
            leasing_obj = s.get(LeasingTypes, leasing_type_id)
           
            fossil_wltp_values = [5.2, 5.8, 6.3, 4.9]
            el_wltp_values = [15.5, 16.8, 18.2, 14.9]

            

            allowed_fuels = vehicle_type_to_fuel.get(vehicle_type_id, [])
            fuel_type_id = next((fid for fid in allowed_fuels if fid in fuel_by_id), None)
            if fuel_type_id is None:
                continue

            fuel_obj = fuel_by_id[fuel_type_id]


            wltp_field = vehicle_type_to_wltp.get(vehicle_type_id)

            wltp_fossil_val = None
            wltp_el_val = None

         
            if wltp_field == "wltp_el":
                wltp_el_val = float(el_wltp_values[el_idx % len(el_wltp_values)])
                el_idx += 1
            elif wltp_field == "wltp_fossil":
                wltp_fossil_val = float(fossil_wltp_values[fossil_idx % len(fossil_wltp_values)])
                fossil_idx += 1

            if fuel_type_id is None:
                continue


            cars.append(
                Cars(
                    imei=f"IMEI-{i+1:04d}",
                    plate=f"{i+1:03d}",
                    make=make,
                    model=model,
                    type=vehicle_type_id,
                    type_obj=vt,
                    fuel=fuel_type_id,
                    fuel_obj=fuel_obj,
                    leasing_type=leasing_type_id,
                    location=location_id,
                    start_leasing=start_leasing,
                    end_leasing=end_leasing,
                    km_aar=20000.0,
                    department=department,
                    deleted=False,
                    disabled=False,
                    test_vehicle=False,
                    location_obj=location_obj,
                    leasing_type_obj=leasing_obj,
                    wltp_fossil=wltp_fossil_val,
                    wltp_el=wltp_el_val,
                    forvaltning=forvaltninger[i % len(forvaltninger)],
                    omkostning_aar=float(
                    omkostning_aar_values[i % len(omkostning_aar_values)]
                    ),
                    
            )
            )

        s.add_all(cars)




def seed_dynamic_roundtrips_and_segments(
    engine,
    *,
    now: Optional[datetime] = None,
    days_back: int = 14,
    trips_per_car: int = 6,
    segments_per_trip: int = 3,
) -> None:
    now = now or datetime.now()
    window_start = now - timedelta(days=days_back)
    Session = sessionmaker(bind=engine)

    with Session() as s:
        cars = s.execute(select(Cars.id, Cars.location, Cars.type)).all()
        cars = [(cid, loc, car_type_id) for (cid, loc, car_type_id) in cars if cid is not None]

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
            s.execute(select(RoundTrips.id).where(RoundTrips.aggregation_type == "seeded"))
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

        fallback_location_id = (
            s.execute(select(AllowedStarts.id).order_by(AllowedStarts.id.asc()))
            .scalars()
            .first()
        )

        for car_id, car_location_id, car_type_id in cars:
            start_location_id = car_location_id or fallback_location_id

            for i in range(trips_per_car):
                frac = i / max(trips_per_car, 1)
                start = window_start + (now - window_start) * frac
                start = start.replace(
                    hour=8 + (i % 8),
                    minute=(i * 7) % 60,
                    second=0,
                    microsecond=0,
                )

                duration = timedelta(minutes=25 + (i % 5) * 15)
                end = start + duration
                minutes = duration.total_seconds() / 60.0
                trip_distance = minutes * km_per_minute(car_type_id)
                seg_count = max(1, segments_per_trip)


                start_lat, start_lon = 56.1104, 10.1779
                end_lat, end_lon = 56.1292, 10.1817

                res = s.execute(
                    insert(RoundTrips).values(
                        car_id=car_id,
                        start_time=start,
                        end_time=end,
                        start_latitude=start_lat,
                        start_longitude=start_lon,
                        end_latitude=end_lat,
                        end_longitude=end_lon,
                        distance=trip_distance,
                        aggregation_type="seeded",
                        driver_name="Seeded Driver",
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
                            distance=trip_distance / seg_count,
                        )
                    )
                    seg_start = seg_end

        s.commit()