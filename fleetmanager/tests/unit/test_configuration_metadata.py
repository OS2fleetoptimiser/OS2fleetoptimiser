from io import BytesIO

import pandas as pd
import pytest

from fleetmanager.configuration.util import validate_vehicle_metadata
from fleetmanager.data_access import Cars
from fleetmanager.model.exceptions import MetadataColumnError, MetadataFileError

# the column headers the uploaded sheet is expected to hold, in sheet order
COLUMNS = [
    "id",
    "Nummerplade",
    "Mærke",
    "Model",
    "Type",
    "Drivmiddel",
    "Wltp (Fossil)",
    "Wltp (El)",
    "Procentvis WLTP",
    "Rækkevidde (km)",
    "Omk./år",
    "Lokation",
    "Afdeling",
    "Forvaltning",
    "Start leasing",
    "Slut leasing",
    "Leasing type",
    "Kilometer pr/år",
    "Hvile",
]

# the first data row of the sheet, as seen by the user
FIRST_ROW = 2


def build_xlsx(rows, columns=None):
    frame = pd.DataFrame(rows, columns=columns or COLUMNS)
    buffer = BytesIO()
    frame.to_excel(buffer, index=False)
    return buffer.getvalue()


def sheet_row(vehicle_id, **overrides):
    row = {
        "id": vehicle_id,
        "Nummerplade": "AA12345",
        "Mærke": "VW",
        "Model": "e-Golf",
        "Type": "elbil",
        "Drivmiddel": "el",
        "Wltp (Fossil)": None,
        "Wltp (El)": 220,
        "Procentvis WLTP": None,
        "Rækkevidde (km)": None,
        "Omk./år": 61000,
        "Lokation": "vej 1",
        "Afdeling": "Hjemmepleje",
        "Forvaltning": "Social og Sundhed",
        "Start leasing": "12-10-2025",
        "Slut leasing": "10-04-2027",
        "Leasing type": "operationel",
        "Kilometer pr/år": 22000,
        "Hvile": None,
    }
    row.update(overrides)
    return row


def seeded_vehicle_id(session):
    return session.query(Cars.id).order_by(Cars.id.asc()).first()[0]


def test_valid_row_is_accepted(db_session):
    vehicle_id = seeded_vehicle_id(db_session)
    xlsx = build_xlsx([sheet_row(vehicle_id)])

    validation, vehicles = validate_vehicle_metadata(db_session, xlsx)

    assert validation[FIRST_ROW] == "ok", validation[FIRST_ROW]
    assert FIRST_ROW in vehicles


def test_unparsable_leasing_date_is_reported_on_its_row(db_session):
    """
    A single unreadable date cell must not fail the whole upload; the customer
    case was "benzin" typed into the Start leasing column.
    """
    vehicle_id = seeded_vehicle_id(db_session)
    xlsx = build_xlsx([sheet_row(vehicle_id, **{"Start leasing": "benzin"})])

    validation, vehicles = validate_vehicle_metadata(db_session, xlsx)

    assert validation[FIRST_ROW].startswith("Fejl i:")
    assert 'Start leasing, kan ikke læses som dato; "benzin"' in validation[FIRST_ROW]
    assert FIRST_ROW not in vehicles


def test_every_error_in_a_row_is_collected(db_session):
    """
    All problems in a row are reported at once, so the user does not have to
    upload again to discover the next one.
    """
    vehicle_id = seeded_vehicle_id(db_session)
    xlsx = build_xlsx(
        [
            sheet_row(
                vehicle_id,
                **{
                    "Lokation": "findes ikke",
                    "Drivmiddel": "rugbrød",
                    "Type": "rumraket",
                    "Leasing type": "lejet",
                },
            )
        ]
    )

    validation, _ = validate_vehicle_metadata(db_session, xlsx)

    message = validation[FIRST_ROW]
    assert message.startswith("Fejl i:")
    for field in ("Lokation", "Drivmiddel", "Type", "Leasingtype"):
        assert field in message, f"{field} missing from {message}"


def test_unknown_id_is_ignored(db_session):
    xlsx = build_xlsx([sheet_row(999999)])

    validation, vehicles = validate_vehicle_metadata(db_session, xlsx)

    assert validation[FIRST_ROW] == "Ignoreres: Id ikke i database"
    assert FIRST_ROW not in vehicles


def test_column_error_names_the_offending_columns(db_session):
    columns = ["Nummerplader" if c == "Nummerplade" else c for c in COLUMNS]
    row = sheet_row(seeded_vehicle_id(db_session))
    row["Nummerplader"] = row.pop("Nummerplade")
    xlsx = build_xlsx([row], columns=columns)

    with pytest.raises(MetadataColumnError) as excinfo:
        validate_vehicle_metadata(db_session, xlsx)

    assert excinfo.value.missing_columns == ["Nummerplade"]
    assert excinfo.value.unexpected_columns == ["Nummerplader"]


def test_unreadable_file_carries_a_reason(db_session):
    with pytest.raises(MetadataFileError) as excinfo:
        validate_vehicle_metadata(db_session, b"this is not a spreadsheet")

    assert excinfo.value.reason, "no reason attached to the rejection"


def test_split_validation_buckets_the_rows():
    from fleetmanager.api.configuration.routes import split_validation

    valid, error, ignore = split_validation(
        {
            2: "ok",
            3: "Fejl i: Drivmiddel, skal udfyldes",
            4: "Ignoreres: Id ikke i database",
        }
    )

    assert valid == [{"row": 2, "msg": "ok"}]
    assert error == [{"row": 3, "msg": "Fejl i: Drivmiddel, skal udfyldes"}]
    assert ignore == [{"row": 4, "msg": "Ignoreres: Id ikke i database"}]
