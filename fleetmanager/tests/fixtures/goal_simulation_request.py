from datetime import datetime, time, timedelta

# Use dynamic dates relative to now to match seeded data (last 14 days)
_now = datetime.now()
_start_date = _now - timedelta(days=14)
_end_date = _now

simulation_request = {
    "start_date": _start_date,
    "end_date": _end_date,
    "location_id": 2,
    "intelligent_allocation": False,
    "limit_km": False,
    # Car IDs 2, 5, 8 are at location 2 (seeding cycles locations 1,2,3)
    "current_vehicles": [2, 5, 8],
    "fixed_vehicles": [2, 5, 8],
    "extra_expenses": 0,
    "co2e_saving": 0,
    "prioritisation": 5,
    "test_vehicles": [],
    "settings": {
        "simulation_settings": {
            "el_udledning": 0.09,
            "benzin_udledning": 2.52,
            "diesel_udledning": 2.98,
            "pris_el": 2.13,
            "pris_benzin": 12.33,
            "pris_diesel": 10.83,
            "hvo_udledning": 0.894,
            "pris_hvo": 19.84,
            "vaerdisaetning_tons_co2": 1500,
            "sub_time": 4,
            "high": 2.17,
            "low": 3.7,
            "distance_threshold": 19999,
            "undriven_type": "benzin",
            "undriven_wltp": 20.0,
            "keep_data": 12,
            "slack": 4,
            "max_undriven": 19,
        },
        "bike_settings": {
            "max_km_pr_trip": 10,
            "percentage_of_trips": 50,
            "bike_slots": [
                {"bike_start": time(8, 0), "bike_end": time(18, 0)},
                {"bike_start": time(12, 3), "bike_end": time(12, 50)},
            ],
            'bike_speed': 8,
            'electrical_bike_speed': 12
        },
        "shift_settings": [
            {
                "location_id": 1,
                "shifts": [
                    {
                        "shift_start": time(7, 0),
                        "shift_end": time(15, 0),
                        "break": time(12, 0),
                    },
                    {
                        "shift_start": time(15, 0),
                        "shift_end": time(23, 0),
                        "break": None,
                    },
                    {
                        "shift_start": time(23, 0),
                        "shift_end": time(7, 0),
                        "break": None,
                    },
                ],
            }
        ],
    },
}
