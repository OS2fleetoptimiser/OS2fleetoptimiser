from sqlalchemy import ForeignKey
from sqlalchemy.orm import (
    relationship,
    Mapped,
    mapped_column,
    DeclarativeBase,
    MappedAsDataclass,
)
from typing import List, Optional
from sqlalchemy.types import String, Float, DateTime, Integer, Boolean
from datetime import datetime


class Base(MappedAsDataclass, DeclarativeBase):
    pass


class Trips(Base):
    __tablename__ = "trips"
    id: Mapped[int | None] = mapped_column(primary_key=True)
    car_id: Mapped[int] = mapped_column(ForeignKey("cars.id"), index=True)
    distance: Mapped[Optional[float]]
    start_time: Mapped[Optional[datetime]] = mapped_column(index=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(index=True)
    start_latitude: Mapped[Optional[float]]
    start_longitude: Mapped[Optional[float]]
    end_latitude: Mapped[Optional[float]]
    end_longitude: Mapped[Optional[float]]
    driver_name: Mapped[Optional[str]] = mapped_column(String(128))
    department: Mapped[Optional[str]] = mapped_column(String(128))
    start_location: Mapped[int] = mapped_column(ForeignKey("allowed_starts.id"))


class RoundTrips(Base):
    __tablename__ = "roundtrips"
    id: Mapped[int | None] = mapped_column(primary_key=True, nullable=False)
    start_time: Mapped[Optional[datetime]] = mapped_column(index=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(index=True)
    start_latitude: Mapped[Optional[float]]
    start_longitude: Mapped[Optional[float]]
    end_latitude: Mapped[Optional[float]]
    end_longitude: Mapped[Optional[float]]
    distance: Mapped[Optional[float]]
    aggregation_type: Mapped[Optional[str]] = mapped_column(String(128))
    driver_name: Mapped[Optional[str]] = mapped_column(String(128))
    start_location_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("allowed_starts.id")
    )
    trip_segments: Mapped[List["RoundTripSegments"]] = relationship()
    car_id: Mapped[int] = mapped_column(ForeignKey("cars.id"), index=True)
    car: Mapped["Cars"] = relationship(
        "Cars", back_populates="round_trips", default=None
    )


class RoundTripSegments(Base):
    __tablename__ = "roundtripsegments"
    id: Mapped[int | None] = mapped_column(primary_key=True, nullable=False)
    distance: Mapped[Optional[float]]
    start_time: Mapped[Optional[datetime]]
    end_time: Mapped[Optional[datetime]]
    round_trip_id = mapped_column(ForeignKey("roundtrips.id"), index=True)


class AllowedStarts(Base):
    __tablename__ = "allowed_starts"
    address: Mapped[Optional[str]] = mapped_column(String(128))
    latitude: Mapped[Optional[float]]
    longitude: Mapped[Optional[float]]
    id: Mapped[Optional[int]] = mapped_column(primary_key=True, nullable=False, default=None, init=False)
    addition_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, default_factory=datetime.now
    )
    cars: Mapped[List["Cars"]] = relationship(
        back_populates="location_obj", default_factory=list
    )
    additions: Mapped[List["AllowedStartAdditions"]] = relationship(
        "AllowedStartAdditions", back_populates="allowed_start", default_factory=list
    )


class AllowedStartAdditions(Base):
    __tablename__ = 'allowed_start_additions'
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=False)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=False)
    allowed_start_id: Mapped[int] = mapped_column(
        ForeignKey('allowed_starts.id'), index=True, nullable=False, init=False
    )
    allowed_start: Mapped["AllowedStarts"] = relationship(
        "AllowedStarts", back_populates="additions"
    )
    addition_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    id: Mapped[int | None] = mapped_column(Integer, primary_key=True, nullable=False, default=None, init=False)


class LeasingTypes(Base):
    __tablename__ = "leasing_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))


class FuelTypes(Base):
    __tablename__ = "fuel_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    refers_to: Mapped[Optional[int]]


class VehicleTypes(Base):
    __tablename__ = "vehicle_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    refers_to: Mapped[Optional[int]]


class Cars(Base):
    __tablename__ = "cars"
    id: Mapped[int] = mapped_column(primary_key=True, nullable=False, init=False)
    imei: Mapped[str] = mapped_column(String(20), nullable=True, default=None)
    plate: Mapped[Optional[str]] = mapped_column(String(128), default=None)
    make: Mapped[Optional[str]] = mapped_column(String(128), default=None)
    model: Mapped[Optional[str]] = mapped_column(String(128), default=None)
    type: Mapped[int | None] = mapped_column(
        ForeignKey("vehicle_types.id"), default=None
    )
    type_obj: Mapped[VehicleTypes | None] = relationship(default=None)
    fuel: Mapped[Optional[int]] = mapped_column(
        ForeignKey("fuel_types.id"), default=None
    )
    fuel_obj: Mapped[Optional["FuelTypes"]] = relationship(default=None)
    wltp_fossil: Mapped[Optional[float]] = mapped_column(Float(), default=None)
    wltp_el: Mapped[Optional[float]] = mapped_column(Float(), default=None)
    capacity_decrease: Mapped[Optional[float]] = mapped_column(
        Float(), default=None
    )  # percentage if range is less than expected
    # (e.g. elbil 80% range during winter)
    co2_pr_km: Mapped[Optional[float]] = mapped_column(Float(), default=None)
    range: Mapped[Optional[float]] = mapped_column(Float(), default=None)
    omkostning_aar: Mapped[Optional[float]] = mapped_column(Float(), default=None)
    location: Mapped[Optional[int]] = mapped_column(
        ForeignKey("allowed_starts.id"), default=None
    )
    location_obj: Mapped[Optional["AllowedStarts"]] = relationship(default=None)
    start_leasing: Mapped[Optional[datetime]] = mapped_column(DateTime(), default=None)
    end_leasing: Mapped[Optional[datetime]] = mapped_column(DateTime(), default=None)
    leasing_type: Mapped[Optional[int]] = mapped_column(
        ForeignKey("leasing_types.id"), default=None
    )
    leasing_type_obj: Mapped[Optional["LeasingTypes"]] = relationship(default=None)
    km_aar: Mapped[Optional[float]] = mapped_column(
        Float(), default=None
    )  # hvis der findes km-forbrug på leasingaftalen
    sleep: Mapped[Optional[int]] = mapped_column(
        Integer(), default=None
    )  # Amount of hours electric vehicles needs for charging each day
    department: Mapped[Optional[str]] = mapped_column(String(128), default=None)
    deleted: Mapped[Optional[bool]] = mapped_column(Boolean(), default=False)
    disabled: Mapped[Optional[bool]] = mapped_column(Boolean(), default=False)
    round_trips: Mapped[Optional[List["RoundTrips"]]] = relationship(
        "RoundTrips", back_populates="car", default_factory=list
    )
    forvaltning: Mapped[Optional[bool]] = mapped_column(String(128), default=None)
    description: Mapped[Optional[bool]] = mapped_column(String(128), default=None)
    test_vehicle: Mapped[Optional[bool]] = mapped_column(Boolean(), default=False)


class SimulationSettings(Base):
    __tablename__ = "simulation_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(128))


class UserLogin(Base):
    __tablename__ = 'user_login'
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    last_seen_date: Mapped[datetime] = mapped_column(DateTime)


def get_default_leasing_types():
    return [
        LeasingTypes(id=1, name="operationel"),
        LeasingTypes(id=2, name="finansiel"),
        LeasingTypes(id=3, name="ejet"),
    ]


def get_default_fuel_types():
    return [
        FuelTypes(id=1, name="benzin", refers_to=1),
        FuelTypes(id=2, name="diesel", refers_to=2),
        FuelTypes(id=3, name="el", refers_to=3),
        FuelTypes(id=4, name="hybrid", refers_to=1),
        FuelTypes(id=5, name="plugin hybrid benzin", refers_to=1),
        FuelTypes(id=6, name="plugin hybrid diesel", refers_to=2),
        FuelTypes(id=7, name="electric3", refers_to=3),
        FuelTypes(id=8, name="electric", refers_to=3),
        FuelTypes(id=9, name="petrol", refers_to=1),
        FuelTypes(id=10, name="bike", refers_to=10),
        FuelTypes(id=11, name="hvo", refers_to=11)
    ]


def get_default_vehicle_types():
    return [
        VehicleTypes(id=1, name="cykel", refers_to=1),
        VehicleTypes(id=2, name="elcykel", refers_to=2),
        VehicleTypes(id=3, name="elbil", refers_to=3),
        VehicleTypes(id=4, name="fossilbil", refers_to=4),
    ]


def get_default_simulation_settings():
    return [
        SimulationSettings(id=1, name="el_udledning", value="0.09", type="float"),
        SimulationSettings(id=2, name="benzin_udledning", value="2.52", type="float"),
        SimulationSettings(id=3, name="diesel_udledning", value="2.98", type="float"),
        SimulationSettings(id=4, name="pris_el", value="2.13", type="float"),
        SimulationSettings(id=5, name="pris_benzin", value="12.33", type="float"),
        SimulationSettings(id=6, name="pris_diesel", value="10.83", type="float"),
        SimulationSettings(
            id=7, name="vaerdisaetning_tons_co2", value="1500", type="float"
        ),
        SimulationSettings(id=8, name="sub_time", value="5", type="float"),
        SimulationSettings(id=9, name="high", value="2.17", type="float"),
        SimulationSettings(id=10, name="low", value="3.7", type="float"),
        SimulationSettings(
            id=11, name="distance_threshold", value="20000", type="float"
        ),
        SimulationSettings(id=12, name="undriven_type", value="benzin", type="string"),
        SimulationSettings(id=13, name="undriven_wltp", value="20", type="float"),
        SimulationSettings(
            id=14,
            name="vagt_dashboard",
            value="[{'shift_start': '07:00:00', 'shift_end': '15:00:00', 'break': None}, {'shift_start': '15:00:00', 'shift_end': '23:00:00', 'break': None}, {'shift_start': '23:00:00', 'shift_end': '07:00:00', 'break': None}]",
            type="string",
        ),
        SimulationSettings(id=15, name="keep_data", value="24", type="float"),
        SimulationSettings(id=16, name="slack", value="0", type="float"),
        SimulationSettings(id=17, name="max_undriven", value="20", type="float"),
        SimulationSettings(
            id=18,
            name="bike_settings",
            value="{'bike-max-km-per-trip': '15', 'bike-percent-of-trips': '100', 'bike_start': ['07:00:00'], 'bike_end': ['15:30:00'], 'bike_speed': '20', 'electrical_bike_speed': '30'}",
            type="string",
        ),
        SimulationSettings(id=19, name="pris_hvo", value="19.84", type="float"),
        SimulationSettings(id=20, name="hvo_udledning", value="0.894", type="float"),
    ]


vehicle_type_to_fuel = {1: [10], 2: [10], 3: [3, 7, 8], 4: [1, 2, 4, 5, 6, 9, 11]}

vehicle_type_to_wltp = {1: None, 2: None, 3: "wltp_el", 4: "wltp_fossil"}
