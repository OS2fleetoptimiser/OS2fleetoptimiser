from datetime import date, timedelta, datetime, time

from fleetmanager.api.configuration.schemas import (
    Vehicle,
    VehicleInput,
    SimulationSettings,
    SimulationConfiguration,
    LocationShifts,
    Shift,
)
from fleetmanager.configuration.util import (
    get_vehicles,
    update_single_vehicle,
    get_single_vehicle,
    get_dropdown_data,
    create_single_vehicle,
    delete_single_vehicle,
    move_vehicle,
    get_all_configurations_from_db,
    validate_settings,
    save_all_configurations,
)
from fleetmanager.data_access import Cars, RoundTrips


def test_get_vehicles(db_session):
    vehicles = get_vehicles(db_session)
    assert (
        len(vehicles) == 35
    ), f"Number of vehicles not the expected 35, but {len(vehicles)}"
    assert all(
        [
            all([key in vehicle.keys() for key in Vehicle.__fields__.keys()])
            for vehicle in vehicles
        ]
    ), "There were vehicles with missing values"


def test_update_single_vehicle(db_session):
    vehicle = Vehicle(id=407, name="name", omkostning_aar=1001, location={"id": 3})
    ok = update_single_vehicle(db_session, vehicle=vehicle)
    assert ok == "ok"

    updated_vehicle = get_single_vehicle(db_session, vehicle_id=407)

    assert (
        vehicle.omkostning_aar == updated_vehicle["omkostning_aar"]
    ), "The vehicle omkostning_aar was not updated"


def test_get_dropdown_data(db_session):
    (
        vehicle_types,
        fuel_types,
        leasing_types,
        locations,
        departments,
    ) = get_dropdown_data(db_session)
    assert len(vehicle_types) == 4
    assert len(fuel_types) == 11
    assert len(leasing_types) == 3
    assert len(locations) == 3
    assert len(departments) == 4


def test_create_delete_vehicle(db_session):
    vehicle = VehicleInput(
        name="name",
        make="John",
        model="Mobil",
        wltp_fossil="10",
        type={"id": 4},
        fuel={"id": 1},
        location={"id": 3},
        leasing_type={"id": 1},
        start_leasing=date.today() - timedelta(days=365),
        end_leasing=date.today() + timedelta(730),
        omkostning_aar=112000,
        test_vehicle=True
    )

    saved_id = create_single_vehicle(db_session, vehicle=vehicle)
    types_conversion = [str, int, float, type(None), datetime, bool]
    assert saved_id == 1000000, f"ID is not the expected 1000000"
    saved_vehicle = get_single_vehicle(db_session, vehicle_id=saved_id)
    matching = [
        saved_vehicle.get(key) == value
        if type(value) in types_conversion
        else value.id == saved_vehicle.get(key).get("id")
        for key, value in vehicle.__dict__.items()
        if key not in ("id", "name")
    ]
    assert all(
        matching
    ), f"The values of the saved does not match the expected {saved_vehicle}"

    delete_single_vehicle(db_session, vehicle_id=saved_id)
    saved_vehicle = get_single_vehicle(db_session, saved_id)
    assert saved_vehicle.get("deleted", False), "Vehicle was not properly deleted"


def test_move_vehicle(db_session):
    roundtrips_before_moving = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 277).all()
    )
    len_before_moving = len(
        list(
            filter(
                lambda roundtrip: roundtrip.start_location_id == 2,
                roundtrips_before_moving,
            )
        )
    )
    assert len_before_moving == len(
        roundtrips_before_moving
    ), "RoundTrips did not all have start location 2"

    move_vehicle(db_session, 277, date(2022, 3, 15), 1)

    roundtrips_after_moving = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 277).all()
    )
    len_location_2_after_moving = len(
        list(
            filter(
                lambda roundtrip: roundtrip.start_location_id == 2,
                roundtrips_after_moving,
            )
        )
    )
    len_location_1_after_moving = len(
        list(
            filter(
                lambda roundtrip: roundtrip.start_location_id == 1,
                roundtrips_after_moving,
            )
        )
    )

    assert len_location_2_after_moving != len_before_moving, "RoundTrips were not moved"
    assert (
        len_location_1_after_moving + len_location_2_after_moving == len_before_moving
    ), "Lost some RoundTrips in the move"

    move_vehicle(db_session, 277, date(2022, 3, 15), delete=True)

    roundtrips_after_deleting = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 277).all()
    )
    len_car_277_after_deleting = len(roundtrips_after_deleting)

    assert (
        len_car_277_after_deleting == len_location_2_after_moving
    ), f"All expected RoundTrips were not deleted"
    roundtrips_after_deleting = (
        db_session.query(RoundTrips)
        .filter(RoundTrips.car_id == 277, RoundTrips.end_time > date(2022, 3, 15))
        .all()
    )

    assert (
        len(roundtrips_after_deleting) == 0
    ), f"RoundTrips after the delete date is expected to 0"


def test_get_all_configurations_and_validation(db_session):
    configuration = get_all_configurations_from_db(db_session)
    assert all(
        key in configuration
        for key in ["shift_settings", "bike_settings", "simulation_settings"]
    ), f"Missing keys in configuration"
    shift_settings = configuration["shift_settings"]
    assert type(shift_settings) == list
    assert type(shift_settings[0]) == dict
    assert all(
        [
            key
            in next(
                filter(
                    lambda location_shift: location_shift["location_id"] == -1,
                    shift_settings,
                )
            )["shifts"][0]
            for key in ["break", "shift_end", "shift_start"]
        ]
    )

    bike_settings = configuration["bike_settings"]
    assert all(
        [
            key in bike_settings.keys()
            for key in [
                "bike_end",
                "bike_start",
                "max_km_pr_trip",
                "percentage_of_trips",
            ]
        ]
    )

    simulation_settings = configuration["simulation_settings"]
    assert type(simulation_settings) == dict
    assert all(
        key in simulation_settings.keys()
        for key in SimulationSettings.__fields__.keys()
    )

    simulation_config = validate_settings(configuration)
    assert type(simulation_config) == SimulationConfiguration


def test_save_all_configuration(db_session):
    configuration_before_saving = validate_settings(
        get_all_configurations_from_db(db_session)
    )
    bike_settings = {
            "max_km_pr_trip": 20,
            "percentage_of_trips": 100,
            "bike_slots": [{"bike_start": time(7, 0), "bike_end": time(15, 30)}],
            "bike_speed": 8,
            "electrical_bike_speed": 12,
        }

    shift_settings = [
        LocationShifts(
            address="LC Holme, Nygårdsvej 34, 8270 Højbjerg",
            location_id=1,
            shifts=[
                Shift(shift_start="12:00", shift_end="00:00"),
                Shift(shift_start="00:00", shift_end="12:00"),
            ],
        )
    ]

    simulation_settings = {"pris_benzin": 14}
    save_all_configurations(
        db_session,
        {
            "bike_settings": bike_settings,
            "shift_settings": shift_settings,
            "simulation_settings": simulation_settings,
        },
    )
    configuration_after_saving = validate_settings(
        get_all_configurations_from_db(db_session)
    )

    assert (
        configuration_after_saving.simulation_settings.pris_benzin
        != configuration_before_saving.simulation_settings.pris_benzin
    )
    assert bike_settings == configuration_after_saving.bike_settings.dict()
    assert shift_settings[0] == next(
        filter(
            lambda location_shift: location_shift.location_id == 1,
            configuration_after_saving.shift_settings,
        )
    )
