from datetime import date, timedelta

from fleetmanager.configuration.util import move_vehicle
from fleetmanager.simulation_setup.util import get_location_vehicles


def test_get_location_vehicles(db_session):
    # Use dynamic dates within the seeded data range (last 14 days)
    start = date.today() - timedelta(days=14)
    end = date.today()
    move_date = date.today() - timedelta(days=7)

    # pull the original
    location_vehicles = get_location_vehicles(
        db_session, start_date=start, end_date=end
    )

    # move vehicle 2 (at location 2) to location 1
    move_vehicle(db_session, vehicle_id=2, from_date=move_date, to_location=1)

    # test the old location
    location_vehicles_moved = get_location_vehicles(
        db_session, start_date=start, end_date=end
    )

    vehicle_expectations = [
        {"id": 1, "count": 3},
        {"id": 2, "count": 1},
        {"id": 3, "count": 1},
    ]
    vehicle_moved_expectations = [
        {"id": 1, "count": 4},
        {"id": 2, "count": 1},
        {"id": 3, "count": 1},
    ]

    assert len(location_vehicles.locations) == len(
        vehicle_expectations
    ), "Expected 3 locations returned"
    assert len(location_vehicles_moved.locations) == len(
        vehicle_expectations
    ), "Expected 3 locations returned"
    assert all(
        map(
            lambda location_expectation: len(
                next(
                    filter(
                        lambda location: location.id == location_expectation["id"],
                        location_vehicles.locations,
                    )
                ).vehicles
            )
            == location_expectation["count"],
            vehicle_expectations,
        )
    ), "Some locations did not hold the expected number of vehicles"

    assert all(
        map(
            lambda location_expectation: len(
                next(
                    filter(
                        lambda location: location.id == location_expectation["id"],
                        location_vehicles_moved.locations,
                    )
                ).vehicles
            )
            == location_expectation["count"],
            vehicle_moved_expectations,
        )
    ), "Some locations did not hold the expected number of vehicles"

    def vehicle_getter(data, vehicle_id, location_id):
        return next(
            filter(
                lambda vehicles: vehicles.id == vehicle_id,
                next(
                    filter(
                        lambda location: location.id == location_id,
                        data,
                    )
                ).vehicles,
            )
        )

    vehicle_location_1_2 = vehicle_getter(location_vehicles_moved.locations, 2, 1)
    vehicle_location_3_2 = vehicle_getter(location_vehicles_moved.locations, 2, 3)

    assert (
        vehicle_location_1_2.status == "ok"
    ), 'Vehicle 2 did not have the expected "ok" status at location 1'
    assert (
        vehicle_location_3_2.status == "locationChanged"
    ), 'Vehicle 2 did not have the expected "locationChanged"'
