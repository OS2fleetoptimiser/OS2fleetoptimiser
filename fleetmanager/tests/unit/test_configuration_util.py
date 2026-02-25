from datetime import date, datetime, time, timedelta

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
from fleetmanager.data_access import AllowedStarts, VehicleTypes, FuelTypes, LeasingTypes, Cars



def test_get_vehicles(db_session):
    vehicles = get_vehicles(db_session)
    assert (
        len(vehicles) == 7
    ), f"Number of vehicles not the expected 7, but {len(vehicles)}"
    assert all(
        [
            all([key in vehicle.keys() for key in Vehicle.__fields__.keys()])
            for vehicle in vehicles
        ]
    ), "There were vehicles with missing values"


def test_update_single_vehicle(db_session):
    # Use vehicle ID 1 which exists in seeded data
    vehicle = Vehicle(id=1, name="name", omkostning_aar=1001, location={"id": 1})
    ok = update_single_vehicle(db_session, vehicle=vehicle)
    assert ok == "ok"

    updated_vehicle = get_single_vehicle(db_session, vehicle_id=1)

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
    assert len(departments) == 2


def test_create_delete_vehicle(db_session):
    """
    Test creating and deleting a vehicle.

    Checklist of requirements:
    1. Location must exist in AllowedStarts table
    2. VehicleType must exist in vehicle_types table
    3. FuelType must exist in fuel_types table
    4. LeasingType must exist in leasing_types table
    5. Fuel must be compatible with vehicle type (vehicle_type_to_fuel mapping)
    """

    # Step 1: Verify/create location
    locations = db_session.query(AllowedStarts).all()
    if not locations:
        test_location = AllowedStarts(address="Test Location", latitude=56.0, longitude=10.0)
        db_session.add(test_location)
        db_session.commit()
        location_id = test_location.id
    else:
        location_id = locations[0].id

    # Step 2: Verify types exist
    vehicle_types = db_session.query(VehicleTypes).all()
    fuel_types = db_session.query(FuelTypes).all()
    leasing_types = db_session.query(LeasingTypes).all()

    assert len(vehicle_types) > 0, f"No vehicle types found"
    assert len(fuel_types) > 0, f"No fuel types found"
    assert len(leasing_types) > 0, f"No leasing types found"

    # Step 3: Get existing car count to calculate expected new ID
    existing_cars = db_session.query(Cars).all()
    existing_max_id = max([c.id for c in existing_cars]) if existing_cars else 0
    expected_new_id = max(1000000, existing_max_id + 1)

    # Step 4: Use type 3 (elbil) with fuel 3 (el) - confirmed compatible
    # Provide all required fields (Pydantic v2 requires explicit None for optional fields without defaults)
    vehicle = VehicleInput(
        id=None,  # Will be assigned by create_single_vehicle
        name="Test Vehicle",
        make="TestMake",
        model="TestModel",
        plate=None,
        range=None,
        capacity_decrease=None,
        wltp_fossil=None,
        wltp_el=15.5,
        co2_pr_km=None,
        km_aar=None,
        sleep=None,
        department=None,
        type={"id": 3},
        fuel={"id": 3},
        location={"id": location_id},
        leasing_type={"id": 1},
        start_leasing=date.today() - timedelta(days=365),
        end_leasing=date.today() + timedelta(days=730),
        omkostning_aar=50000.0
    )

    # Step 5: Create vehicle
    saved_id = create_single_vehicle(db_session, vehicle=vehicle)

    # Verify creation succeeded
    assert isinstance(saved_id, int), f"Vehicle creation failed with error: {saved_id}"
    assert saved_id == expected_new_id, f"Expected ID {expected_new_id}, got {saved_id}"

    # Step 6: Verify retrieval
    saved_vehicle = get_single_vehicle(db_session, vehicle_id=saved_id)
    assert saved_vehicle is not None, "Could not retrieve saved vehicle"
    assert saved_vehicle.get("make") == "TestMake", f"Make mismatch: {saved_vehicle.get('make')}"

    # Step 7: Delete and verify
    delete_single_vehicle(db_session, vehicle_id=saved_id)
    saved_vehicle = get_single_vehicle(db_session, saved_id)
    assert saved_vehicle.get("deleted", False), "Vehicle was not properly deleted"


def test_move_vehicle(db_session):
    # Use dynamic date within the seeded trip range (last 14 days)
    move_date = date.today() - timedelta(days=7)

    roundtrips_before_moving = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 2).all()
    )
    len_before_moving = len(
        list(
            filter(
                lambda roundtrip: roundtrip.start_location_id == 3,
                roundtrips_before_moving,
            )
        )
    )
    assert len_before_moving == len(
        roundtrips_before_moving
    ), "RoundTrips did not all have start location 3"

    move_vehicle(db_session, 2, move_date, 1)

    roundtrips_after_moving = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 2).all()
    )
    len_location_3_after_moving = len(
        list(
            filter(
                lambda roundtrip: roundtrip.start_location_id == 3,
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

    assert len_location_3_after_moving != len_before_moving, "RoundTrips were not moved"
    assert (
        len_location_1_after_moving + len_location_3_after_moving == len_before_moving
    ), "Lost some RoundTrips in the move"

    move_vehicle(db_session, 2, move_date, delete=True)

    roundtrips_after_deleting = (
        db_session.query(RoundTrips).filter(RoundTrips.car_id == 2).all()
    )
    len_car_2_after_deleting = len(roundtrips_after_deleting)

    assert (
        len_car_2_after_deleting == len_location_3_after_moving
    ), f"All expected RoundTrips were not deleted"
    roundtrips_after_deleting = (
        db_session.query(RoundTrips)
        .filter(RoundTrips.car_id == 2, RoundTrips.end_time > move_date)
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
            address="vej 1",  # Matches seeded location address
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
