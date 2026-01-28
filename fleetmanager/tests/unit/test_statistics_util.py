from datetime import date, datetime, time, timedelta
from io import BytesIO

import pandas as pd

from fleetmanager.statistics.util import (
    get_summed_statistics,
    carbon_neutral_share,
    emission_series,
    total_driven,
    daily_driving,
    driving_data_to_excel,
)

# Use dynamic dates within the seeded data range (last 14 days)
_today = date.today()
start_date = _today - timedelta(days=14)
end_date = _today
extra_day = timedelta(days=3)


def test_summed_statistics(db_session):
    statistics_overview = get_summed_statistics(db_session)

    # Seeding creates 8 cars with 6 trips each = 48 trips
    assert (
        statistics_overview.total_roundtrips == 48
    ), f"Number of total roundtrips was unexpected, {statistics_overview.total_roundtrips}"
    # First date should be within the seeded range
    assert (
        statistics_overview.first_date >= start_date
    ), f"First roundtrip date was unexpected date, {statistics_overview.first_date}"
    assert (
        statistics_overview.last_date <= end_date
    ), f"Last roundtrip date was unexpected date, {statistics_overview.last_date}"
    # Total driven should be positive
    assert (
        statistics_overview.total_driven > 0
    ), f"Total driven was unexpected km, {statistics_overview.total_driven}"
    # Emission should be non-negative
    assert (
        statistics_overview.total_emission >= 0
    ), f"Total emission was unexpected, {statistics_overview.total_emission}"
    # Share carbon neutral should be between 0 and 100
    assert (
        0 <= statistics_overview.share_carbon_neutral <= 100
    ), f"Share of carbon neutral driving was unexpected, {statistics_overview.share_carbon_neutral}"


def test_carbon_neutral_share(db_session):
    carbon_neutral_share_trend = carbon_neutral_share(
        db_session,
        start_date=datetime.combine(start_date, time(0, 0, 0)),
        end_date=datetime.combine(end_date, time(0, 0, 0)) + extra_day,
    )

    # Verify the function returns the expected structure
    assert "x" in carbon_neutral_share_trend, "Response missing 'x' key"
    assert "y" in carbon_neutral_share_trend, "Response missing 'y' key"
    # Verify lists have same length
    assert len(carbon_neutral_share_trend["x"]) == len(carbon_neutral_share_trend["y"]), \
        "x and y lists should have same length"


def test_emission_series(db_session):
    emission_series_trend = emission_series(
        db_session,
        start_date=datetime.combine(start_date, time(0, 0, 0)),
        end_date=datetime.combine(end_date, time(0, 0, 0)) + extra_day,
    )

    # Should have at least one entry for the time period
    assert (
        len(emission_series_trend["x"]) >= 1
    ), f"There wasn't the expected number of entries, {len(emission_series_trend['x'])}"
    # Emission should be non-negative
    assert (
        sum(emission_series_trend["y"]) >= 0
    ), f"The total emission should be non-negative"


def test_total_driven(db_session):
    total_driven_trend = total_driven(
        db_session,
        start_date=datetime.combine(start_date, time(0, 0, 0)),
        end_date=datetime.combine(end_date, time(0, 0, 0)) + extra_day,
    )

    # Should have at least one entry for the time period
    assert (
        len(total_driven_trend["x"]) >= 1
    ), f"There wasn't the expected number of entries, {len(total_driven_trend['x'])}"
    # Total driven should be positive
    assert (
        sum(total_driven_trend["y"]) > 0
    ), f"Total driven should be positive"


def test_daily_driving_and_export(db_session):
    response = daily_driving(
        db_session,
        start_date=datetime.combine(start_date, time(0, 0, 0)),
        end_date=datetime.combine(end_date, time(0, 0, 0)) + extra_day,
        include_trip_segments=True,
        locations=[1, 2, 3],
    )

    # Use seeded vehicle IDs (1-8)
    response_with_additional_filters = daily_driving(
        db_session,
        start_date=datetime.combine(start_date, time(0, 0, 0)),
        end_date=datetime.combine(end_date, time(0, 0, 0)) + extra_day,
        vehicles=[1, 2, 3, 4, 5, 6, 7, 8],
    )

    assert (
        response["query_start_date"]
        == response_with_additional_filters["query_start_date"]
    )
    assert (
        response["query_end_date"] == response_with_additional_filters["query_end_date"]
    )
    # Both queries should return driving data
    assert len(response["driving_data"]) > 0, "Expected driving data from location filter"
    assert len(response["driving_data"]) == len(
        response_with_additional_filters["driving_data"]
    ), "Location and vehicle filters should return same data"

    stream = driving_data_to_excel(response, 40)
    assert (
        type(stream) == BytesIO
    ), f"Returned stream is not expected type BytesIO, but {type(stream)}"
