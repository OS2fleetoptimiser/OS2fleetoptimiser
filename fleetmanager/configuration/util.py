from ast import literal_eval
from datetime import time, date, datetime
from io import BytesIO
from typing import Dict, List, TypedDict, Union

import pandas as pd
from pydantic import ValidationError
from sqlalchemy import func, select, cast, Numeric
from sqlalchemy.orm import Session
from typing_extensions import NotRequired

from fleetmanager.api.configuration.schemas import (
    BikeSettings,
    BikeSlot,
    LocationShifts,
    Shift,
    SimulationConfiguration,
)
from fleetmanager.api.configuration.schemas import SimulationSettings as SimIn
from fleetmanager.api.configuration.schemas import Vehicle, VehicleInput
from fleetmanager.data_access.dbschema import (
    AllowedStarts,
    Cars,
    FuelTypes,
    LeasingTypes,
    RoundTrips,
    RoundTripSegments,
    SimulationSettings,
    VehicleTypes,
    get_default_fuel_types,
    get_default_leasing_types,
    get_default_vehicle_types,
)

from fleetmanager.model.exceptions import (
    MetadataColumnError,
    MetadataRowInvalidError,
    MetadataFileError,
)

shift_time = TypedDict(
    "shift_time",
    {
        "shift_start": str,
        "shift_end": str,
        "break": NotRequired[str],
        "shift_break": NotRequired[time],
    },
)

day_schedule = List[shift_time]

location_shift = TypedDict(
    "location_shift",
    {
        "location_id": int,
        "shifts": List[day_schedule],
    },
)

bike_setting = TypedDict(
    "bike_setting",
    {"max_km_pr_trip": int, "percentage_of_trips": float, "bike_slots": list},
)


all_settings = TypedDict(
    "all_settings",
    {
        "shift_settings": Union[List[LocationShifts], List[location_shift]],
        "bike_settings": bike_setting,
        "simulation_settings": Dict,
    },
)


def get_vehicles(session: Session):
    """
    Function to pull all the vehicles from the database.
    Will add associated objects to the vehicle object
    """
    deleted_vehicles_ids = session.execute(
        select(Cars.id).where(Cars.deleted == 1)
    ).fetchall()

    # to prevent sqlalchemy warning about coercing
    deleted_vehicles_ids = [id_ for id_, in deleted_vehicles_ids]

    vehicles = session.query(Cars).filter(Cars.id.notin_(deleted_vehicles_ids))
    fuel_types = {fuel.id: fuel.name for fuel in session.query(FuelTypes)}
    allowed_starts = {start.id: start.address for start in session.query(AllowedStarts)}
    vehicle_types = {
        vehicle.id: vehicle.name for vehicle in session.query(VehicleTypes)
    }
    leasing_types = {
        leasing.id: leasing.name for leasing in session.query(LeasingTypes)
    }

    name_fields = load_name_settings(session)
    sorted_vehicles = []
    for vehicle in vehicles:
        current_vehicle = vehicle.__dict__.copy()
        if current_vehicle.get("forvaltning") == "":
            current_vehicle["forvaltning"] = None
        del current_vehicle["_sa_instance_state"]
        current_vehicle["location"] = {
            "id": current_vehicle["location"],
            "address": (
                None
                if pd.isna(current_vehicle["location"])
                else allowed_starts[current_vehicle["location"]]
            ),
        }
        current_vehicle["fuel"] = {
            "id": current_vehicle["fuel"],
            "name": (
                None
                if pd.isna(current_vehicle["fuel"])
                else fuel_types[current_vehicle["fuel"]]
            ),
        }
        current_vehicle["type"] = {
            "id": current_vehicle["type"],
            "name": (
                None
                if pd.isna(current_vehicle["type"])
                else vehicle_types[current_vehicle["type"]]
            ),
        }
        current_vehicle["leasing_type"] = {
            "id": current_vehicle["leasing_type"],
            "name": (
                None
                if pd.isna(current_vehicle["leasing_type"])
                else leasing_types[current_vehicle["leasing_type"]]
            ),
        }
        current_vehicle["name"] = " ".join(
            [value for field in name_fields if (value := getattr(vehicle, field))]
        )
        sorted_vehicles.append(current_vehicle)

    return sorted_vehicles


def update_single_vehicle(session: Session, vehicle: Vehicle, ignore_none_values=False, accepted_none_values: list = None):
    """
    Function to update a single vehicle in the database.
    Checks that the vehicle and location exists before update any values on the vehicle.
    Any key, value pair will be updated on the vehicle, so all None values will also update on the vehicle.
    accepted_none_values, allows changing vehicle type which implies value change of related wltp field
    """
    if accepted_none_values is None:
        accepted_none_values = []
    locations = [a.id for a in session.query(AllowedStarts.id).all()]
    db_vehicle = session.query(Cars).filter(Cars.id == vehicle.id).first()
    if db_vehicle is None:
        return "the car id does not exist"
    for key, value in vehicle:

        if ignore_none_values and (value is None) and (key not in accepted_none_values):
            continue

        if (
            key in ["leasing_type", "fuel", "type", "location"]
            and pd.isna(value) is False
        ):
            if (
                key == "location"
                and value.id not in locations
                and pd.isna(value.id) is False
            ):
                return f"8.Location id {value.id} does not exist."
            if pd.isna(value.id):
                continue
            value = value.id
        elif (
            key in ["department", "forvaltning"]
            and pd.isna(value) is False
            and value == ""
        ):
            value = None

        setattr(db_vehicle, key, value)

    session.commit()
    return "ok"


def get_dropdown_data(session: Session):
    """
    Function to pull the associated vehicle metadata that is returned as objects.
    """
    vehicle_types = session.query(VehicleTypes).all()
    fuel_types = session.query(FuelTypes).all()
    leasing_types = session.query(LeasingTypes).all()
    locations = session.query(AllowedStarts).all()
    departments = session.query(Cars.department).distinct().all()

    return vehicle_types, fuel_types, leasing_types, locations, departments


def delete_single_vehicle(session: Session, vehicle_id: int):
    """
    Function to delete a vehicle from the database. Will first delete it's associated roundtrip segments and roundtrips.
    Sets the vehicle as deleted, such that it will not be pulled again at the next extraction.
    """
    car = session.get(Cars, int(vehicle_id))
    car.deleted = True

    # to prevent sqlalchemy warning about coercing
    round_trip_ids = session.execute(
        select(RoundTrips.id).where(RoundTrips.car_id == vehicle_id)
    ).fetchall()
    round_trip_ids = [id_ for id_, in round_trip_ids]
    chunk_size = 2000
    for i in range(0, len(round_trip_ids), chunk_size):
        current_rtr = round_trip_ids[i : i + chunk_size]
        session.query(RoundTripSegments).filter(
            RoundTripSegments.round_trip_id.in_(current_rtr)
        ).delete(synchronize_session="fetch")
        session.commit()

    # delete roundtrips
    session.query(RoundTrips).filter(RoundTrips.car_id == vehicle_id).delete(
        synchronize_session="fetch"
    )

    session.commit()


def get_single_vehicle(session: Session, vehicle_id: int):
    """
    Function to pull a single vehicle from its id.
    """
    vehicle = session.query(Cars).filter(Cars.id == vehicle_id).first()

    if vehicle:
        as_dict = vehicle.__dict__.copy()
        del as_dict["_sa_instance_state"]
        if vehicle.location:
            as_dict["location"] = {
                "id": vehicle.location,
                "address": session.query(AllowedStarts.address)
                .filter(AllowedStarts.id == vehicle.location)
                .first()[0],
            }
        if vehicle.type:
            as_dict["type"] = {
                "id": vehicle.type,
                "name": session.query(VehicleTypes.name)
                .filter(VehicleTypes.id == vehicle.type)
                .first()[0],
            }
        if vehicle.fuel:
            as_dict["fuel"] = {
                "id": vehicle.fuel,
                "name": session.query(FuelTypes.name)
                .filter(FuelTypes.id == vehicle.fuel)
                .first()[0],
            }
        if vehicle.leasing_type:
            as_dict["leasing_type"] = {
                "id": vehicle.leasing_type,
                "name": session.query(LeasingTypes.name)
                .filter(LeasingTypes.id == vehicle.leasing_type)
                .first()[0],
            }
        return as_dict
    else:
        return


def create_single_vehicle(session: Session, vehicle: VehicleInput, test_vehicle: bool = True):
    """
    Function to create a vehicle. If the vehicle id is less than "min_allowed_id", the id will be set to 1000000.
    The selected location must exist and the vehicle itself pass validation on Vehicle class.
    """
    key_to_model = {
        "leasing_type": LeasingTypes,
        "fuel": FuelTypes,
        "type": VehicleTypes,
        "location": AllowedStarts,
    }

    min_allowed_id = 1000000
    locations = [a.id for a in session.query(AllowedStarts.id).all()]
    max_id = session.query(func.max(Cars.id)).first()[0]
    if max_id is None or max_id < min_allowed_id:
        new_id = min_allowed_id
    else:
        new_id = max_id + 1

    vehicle_entry = {"id": new_id}
    for key, value in vehicle:
        if key in ("id", "name"):
            continue
        if (
            key in ["leasing_type", "fuel", "type", "location"]
            and pd.isna(value) is False
        ):
            if (
                key == "location"
                and value.id not in locations
                and pd.isna(value.id) is False
            ):
                return f"8.Location id {value.id} does not exist."
            if pd.isna(value.id):
                continue
            value = value.id
            vehicle_entry[f"{key}_obj"] = session.get(key_to_model[key], value)
        vehicle_entry[key] = value

    # manually creating a vehicle implies no fleet management synchronisation hence mark as test_vehicle
    vehicle_entry["test_vehicle"] = test_vehicle
    session.add(Cars(**vehicle_entry))
    session.commit()
    return new_id


def move_vehicle(
    session: Session,
    vehicle_id: int,
    from_date: datetime | date,
    to_location: int = None,
    delete: bool = False,
):
    if type(from_date) == date:
        from_date = datetime.combine(from_date, time(0, 0, 0))

    if delete:
        car = session.get(Cars, int(vehicle_id))
        car.disabled = True

        # to prevent sqlalchemy warning about coercing
        round_trip_ids = session.execute(
            select(RoundTrips.id).where(
                RoundTrips.car_id == vehicle_id, RoundTrips.end_time > from_date
            )
        ).fetchall()
        round_trip_ids = [id_ for id_, in round_trip_ids]

        session.query(RoundTripSegments).filter(
            RoundTripSegments.round_trip_id.in_(round_trip_ids)
        ).delete(synchronize_session="fetch")

        # delete roundtrips
        session.query(RoundTrips).filter(RoundTrips.id.in_(round_trip_ids)).delete(
            synchronize_session="fetch"
        )

        session.commit()
    else:
        car = session.get(Cars, int(vehicle_id))
        car.location = to_location
        # move roundtrips to new location
        session.query(RoundTrips).filter(
            RoundTrips.car_id == vehicle_id, RoundTrips.end_time > from_date
        ).update({"start_location_id": to_location})

        session.commit()


def get_all_configurations_from_db(session: Session):
    """
    Get all the configuration used in FleetOptimiser
    """
    configurations = {
        "shift_settings": load_shift_settings(session, get_all=True),
        "bike_settings": load_bike_configuration_from_db(session),
        "simulation_settings": load_simulation_settings(session),
    }
    return configurations


def all_vagt_addresses_sqllite(session):
    vagter = (
        session.query(SimulationSettings)
        .filter(SimulationSettings.name.contains("vagt_"))
        .all()
    )
    ids_to_addresses = {
        int(row.id): row.address for row in session.query(AllowedStarts)
    }
    return [
        {
            "address": (
                ""
                if "dashboard" in entry.name
                else ids_to_addresses.get(int(entry.name.split("_")[-1]))
            ),
            "location_id": (
                int(entry.name.split("_")[-1]) if "dashboard" not in entry.name else -1
            ),
            "shifts": literal_eval(entry.value),
        }
        for entry in vagter
        if "None" not in entry.name
    ]


def all_vagt_address_postgress(session):
    vagter = (
        session.query(
            SimulationSettings.id,
            SimulationSettings.name,
            SimulationSettings.value,
            func.reverse(SimulationSettings.name).label("reversed_name"),
        )
        .filter(SimulationSettings.name.like("vagt_%"))
        .filter(~SimulationSettings.name.like("%dashboard%"))
    ).subquery()
    split_expression = func.substring(
        vagter.c.reversed_name, 1, func.charindex("_", vagter.c.reversed_name) - 1
    )
    split_expression_reversed = func.reverse(split_expression)

    vagter_address = (
        session.query(
            AllowedStarts.id, AllowedStarts.address, vagter.c.name, vagter.c.value
        )
        .join(
            AllowedStarts, cast(split_expression_reversed, Numeric) == AllowedStarts.id
        )
        .all()
    )

    dashboard_select = (
        session.query(
            SimulationSettings.id,
            SimulationSettings.name,
            SimulationSettings.value,
            SimulationSettings.name.label("address"),
        )
        .filter(SimulationSettings.name == "vagt_dashboard")
        .all()
    )

    return [
        {
            "address": entry.address,
            "location_id": int(entry.id) if "dashboard" not in entry.name else -1,
            "shifts": literal_eval(entry.value),
        }
        for entry in vagter_address + dashboard_select
        if "None" not in entry.name
    ]


def load_shift_settings(
    session: Session, location: int | None = None, get_all: bool = True
):
    """
    Load shift settings from the database. Either a single location's shift or all locations' shift settings.
    """
    vagt = None
    if location is None and get_all is False:
        return []
    if location:
        vagt = (
            session.query(SimulationSettings)
            .filter(SimulationSettings.name == f"vagt_{location}")
            .first()
        )
    elif get_all and "sqlite" not in session.bind.engine.dialect.name:
        return all_vagt_address_postgress(session)
    elif get_all:
        return all_vagt_addresses_sqllite(session)

    if vagt is None:
        return []
    else:
        return literal_eval(vagt.value)


def load_simulation_settings(session: Session):
    """
    Load simulation specific settings from the database.
    """
    settings = (
        session.query(SimulationSettings)
        .filter(
            ~SimulationSettings.name.contains("vagt"),
            ~SimulationSettings.name.contains("bike_settings"),
        )
        .all()
    )
    formatted_settings = {}
    for setting in settings:
        value = setting.value if setting.type != "float" else float(setting.value)
        formatted_settings[setting.name] = value
    return formatted_settings


def load_bike_configuration_from_db(session: Session):
    """
    Load bike specific settings from the database.
    """
    naming = {
        "bike-max-km-per-trip": "max_km_pr_trip",
        "bike-percent-of-trips": "percentage_of_trips",
        "bike_start": "bike_start",
        "bike_end": "bike_end",
        "bike_speed": "bike_speed",
        "electrical_bike_speed": "electrical_bike_speed",
    }
    settings = None
    saved_settings = (
        session.query(SimulationSettings)
        .filter(SimulationSettings.name == "bike_settings")
        .first()
    )
    if saved_settings is not None:
        settings = literal_eval(saved_settings.value)
    settings = {naming[key]: value for key, value in settings.items()}

    return settings


def validate_settings(settings: all_settings):
    """
    Function used to validate the settings according to defined schema standard.
    """
    simulation_config = SimulationConfiguration(
        shift_settings=[
            LocationShifts(
                address=None if "address" not in shift else shift["address"],
                location_id=shift["location_id"],
                shifts=[
                    Shift(
                        shift_start=shift_times["shift_start"],
                        shift_end=shift_times["shift_end"],
                        shift_break=shift_times["break"],
                    )
                    for shift_times in shift["shifts"]
                ],
            )
            for shift in settings["shift_settings"]
            if shift
        ],
        bike_settings=BikeSettings(
            max_km_pr_trip=settings["bike_settings"].get("max_km_pr_trip", None),
            percentage_of_trips=settings["bike_settings"].get(
                "percentage_of_trips", None
            ),
            bike_slots=[
                BikeSlot(bike_start=start, bike_end=end)
                for start, end in zip(
                    settings["bike_settings"].get("bike_start", []),
                    settings["bike_settings"].get("bike_end", []),
                )
            ],
            bike_speed=settings["bike_settings"].get("bike_speed", 20),
            electrical_bike_speed=settings["bike_settings"].get(
                "electrical_bike_speed", 30
            ),
        ),
        simulation_settings=SimIn(**settings["simulation_settings"]),
    )
    return simulation_config


def save_all_configurations(session: Session, settings: all_settings):
    bike_settings = settings.get("bike_settings", None)
    if bike_settings:
        save_bike_configuration_in_db(session, bike_settings)

    simulation_settings = settings.get("simulation_settings", None)
    if simulation_settings:
        save_simulation_settings(session, simulation_settings)

    shift_settings = settings.get("shift_settings", None)
    if shift_settings:
        if type(shift_settings[0]) == LocationShifts:
            shift_settings = [shift.dict() for shift in shift_settings]
        save_shift_settings(session, shift_settings)


def save_shift_settings(session: Session, settings: List[location_shift]):
    names = {
        "shift_start": "shift_start",
        "shift_end": "shift_end",
        "shift_break": "break",
    }
    for location in settings:
        shifts = location.get("shifts", None)
        if shifts is None:
            shifts = []
        key_name = f"vagt_{location['location_id'] if location['location_id'] != -1 else 'dashboard'}"
        # validate that shift_break will also be saved

        save = str(
            [
                add_break(
                    {
                        names[key]: None if pd.isna(value) else str(value)
                        for key, value in shift.items()
                    }
                )
                for shift in shifts
            ]
        )

        current_saved = (
            session.query(SimulationSettings)
            .filter(SimulationSettings.name == key_name)
            .first()
        )
        if current_saved:
            current_saved.value = save
        else:
            session.add(
                SimulationSettings(
                    **{"id": None, "name": key_name, "value": save, "type": "string"}
                )
            )
        session.commit()


def save_simulation_settings(session: Session, settings: Dict):
    keys = list(settings.keys())
    for v in session.query(SimulationSettings).filter(
        SimulationSettings.name.in_(keys)
    ):
        new_value = settings.get(v.name)
        if new_value is None:
            # not allowing null values in simulation settings
            continue
        setattr(v, "value", str(new_value))
        session.commit()


def save_bike_configuration_in_db(session: Session, bike_settings: Dict):
    saved_settings = (
        session.query(SimulationSettings)
        .filter(SimulationSettings.name == "bike_settings")
        .first()
    )
    naming = {
        "max_km_pr_trip": "bike-max-km-per-trip",
        "percentage_of_trips": "bike-percent-of-trips",
        "bike_start": "bike_start",
        "bike_end": "bike_end",
        "bike_speed": "bike_speed",
        "electrical_bike_speed": "electrical_bike_speed",
    }
    save = {
        naming[key]: (
            None if pd.isna(bike_settings.get(key)) else str(bike_settings.get(key))
        )
        for key in [
            "max_km_pr_trip",
            "percentage_of_trips",
            "bike_speed",
            "electrical_bike_speed",
        ]
    }
    for slot in bike_settings.get("bike_slots", []):
        if save.get("bike_start", None) is None:
            save["bike_start"] = []
            save["bike_end"] = []
        save["bike_start"].append(str(slot["bike_start"]))
        save["bike_end"].append(str(slot["bike_end"]))
    save = str(save)
    if saved_settings is None:
        session.add(
            SimulationSettings(
                **{
                    "name": "bike_settings",
                    "value": save,
                    "type": "string",
                }
            )
        )
    else:
        saved_settings.value = save
    session.commit()


def add_break(shift: dict):
    """
    Convenience function to add break key to shift dictionary before saving bike setting
    """
    if "break" not in shift:
        shift["break"] = None
    return shift


def load_name_settings(session: Session):
    if (
        setting := session.query(SimulationSettings)
        .filter(SimulationSettings.name == "name_fields")
        .one_or_none()
    ):
        if setting.type == "list":
            name_fields = literal_eval(setting.value)
        else:
            raise RuntimeError(
                "Setting '{}' with type '{}' is invalid.".format(
                    setting.name, setting.type
                )
            )
    else:
        name_fields = ["plate", "department", "make", "model"]

    return name_fields


def _typelist_to_dict(tl):
    d = {}
    for t in tl:
        d[t.name] = {"id": t.id, "name": t.name}
    return d


def match_errors(id):
    errors = {
        "0": "WLTP-typen er ikke korrekt udfyldt.",
        "1": "WLTP er ikke korrekt udfyldt i forhold til type.",  # "Ukendt fejl.", # - ikke samme som i schemas.py
        "2": "Der er ikke angivet nogen drivmiddeltype.",
        "3": "Drivmiddeltypen stemmer ikke overens med den valgte køretøjstype.",
        "4": 'Drivmiddeltypen for den valgte type må ikke indeholde "WLTP_fossil" eller "WLTP_el".',
        "5": "Den valgte drivmiddeltype eksisterer ikke.",
        "6": "Køretøjstypen eksisterer ikke.",
        "7": "Leasingtypen eksisterer ikke.",
        "8": "Lokationen eksisterer ikke.",
    }
    return errors.get(id, None)

def safe_lower(val):
    return val.strip().lower() if isinstance(val, str) and val.strip() else None

def validate_vehicle_metadata(session: Session, xlsx_bytes: bytes):

    converters = {"Start leasing": pd.to_datetime, "Slut leasing": pd.to_datetime}
    leasing_types = _typelist_to_dict(get_default_leasing_types())
    fuel_types = _typelist_to_dict(get_default_fuel_types())
    vehicle_types = _typelist_to_dict(get_default_vehicle_types())
    locations = {
        loc.address: {"id": loc.id} for loc in session.query(AllowedStarts).all()
    }

    # load into pandas
    try:
        metadata = pd.read_excel(BytesIO(xlsx_bytes), converters=converters)
    except ValueError as e:
        raise MetadataFileError

    metadata = metadata.replace({float("nan"): None})

    column_names = {
        "id": "id",
        "plate": "Nummerplade",
        "make": "Mærke",
        "model": "Model",
        "type": "Type",
        "fuel": "Drivmiddel",
        "wltp_fossil": "Wltp (Fossil)",
        "wltp_el": "Wltp (El)",
        "capacity_decrease": "Procentvis WLTP",
        "co2_pr_km": "CO2 (g/km)",
        "range": "Rækkevidde (km)",
        "omkostning_aar": "Omk./år",
        "location": "Lokation",
        "department": "Afdeling",
        "forvaltning": "Forvaltning",
        "start_leasing": "Start leasing",
        "end_leasing": "Slut leasing",
        "leasing_type": "Leasing type",
        "km_aar": "Kilometer pr/år",
        "sleep": "Hvile",
    }

    unknown_columns = set(metadata.keys()) - set(column_names.values())
    metadata.drop(list(unknown_columns), axis=1, inplace=True)

    # check columns
    if set(metadata.keys()) != set(column_names.values()):
        raise MetadataColumnError

    # get valid ids from database
    valid_ids = [i[0] for i in session.query(Cars.id).all()]

    # check rows
    validation = {}
    vehicles = {}
    for i, row in metadata.iterrows():
        excel_row = i + 2

        vehicle_invalid = False
        if (row["Lokation"] not in locations) and (row["Lokation"] != None):
            validation[excel_row] = "Fejl i: Lokation: Lokation eksisterer ikke"
            vehicle_invalid = True

        drivmiddel = safe_lower(row["Drivmiddel"])
        if drivmiddel not in fuel_types:
            reason = f"skal udfyldes; {', '.join(fuel_types.keys())}" if not drivmiddel else f"ukendt type; \"{drivmiddel}\""
            validation[excel_row] = f"Fejl i: Drivmiddel, {reason}"
            vehicle_invalid = True

        vehicle_type = safe_lower(row["Type"])
        if vehicle_type not in vehicle_types:
            reason = f"skal udfyldes; {', '.join(vehicle_types.keys())}" if not vehicle_type else f"ukendt type; \"{vehicle_type}\""
            validation[excel_row] = f"Fejl i: Type, {reason}"
            vehicle_invalid = True

        leasing_type = safe_lower(row["Leasing type"])
        if leasing_type not in leasing_types:
            reason = f"skal udfyldes; {', '.join(leasing_types.keys())}" if not leasing_type else f"ukendt type; \"{leasing_type}\""
            validation[excel_row] = f"Fejl i: Leasingtype, {reason}"
            vehicle_invalid = True

        if row.get("id") not in valid_ids:
            validation[excel_row] = "Ignoreres: Id ikke i database"
            vehicle_invalid = True

        if vehicle_invalid:
            continue

        try:
            v = Vehicle(
                id=row.id,
                plate=row.Nummerplade,
                make=row.Mærke,
                model=row.Model,
                type=vehicle_types.get(vehicle_type),
                fuel=fuel_types.get(drivmiddel),
                wltp_fossil=row["Wltp (Fossil)"],
                wltp_el=row["Wltp (El)"],
                capacity_decrease=row["Procentvis WLTP"],
                co2_pr_km=row["CO2 (g/km)"],
                range=row["Rækkevidde (km)"],
                omkostning_aar=row["Omk./år"],
                location=locations.get(row["Lokation"]),
                department=row["Afdeling"],
                forvaltning=row["Forvaltning"],
                start_leasing=row["Start leasing"],
                end_leasing=row["Slut leasing"],
                leasing_type=leasing_types.get(leasing_type),
                km_aar=row["Kilometer pr/år"],
                sleep=row["Hvile"],
            )
            validation[excel_row] = "ok"
            vehicles[excel_row] = v

        except ValidationError as e:
            error_fields = []
            for err in e.errors():
                loc = err.get("loc")[0]  # assume un-nested
                f = column_names.get(loc, "Ukendt felt")

                # try known errors first, then pydantic errors, finally default
                msg_id = err.get("msg", " . ").split(".")[0]
                error_msg = match_errors(msg_id) or err.get("msg", "Ukendt fejl")
                error_fields.append(f"{f}: {error_msg}")

            validation[excel_row] = f"Fejl i: {', '.join(error_fields)}"
        except Exception as e:
            validation[excel_row] = "Fejl i: Ukendt"

    return validation, vehicles


def update_vehicle_metadata(
    session: Session, validation: dict[int, str], vehicles: dict[int, Vehicle]
):

    # check for any errors
    valid = all((v == "ok") or (v.startswith("Ignoreres")) for v in validation.values())

    if not valid:
        raise MetadataRowInvalidError

    # update all not-None values
    count = 0

    for key, value in validation.items():
        if value != "ok":
            continue

        vehicle = vehicles[key]
        # we have validated the vehicle to have the correct wltp according to vehicle type, hence accept none values
        res = update_single_vehicle(
            session,
            vehicle,
            ignore_none_values=True,
            accepted_none_values=["wltp_fossil", "wltp_el"]
        )
        count = count + 1

    return count
