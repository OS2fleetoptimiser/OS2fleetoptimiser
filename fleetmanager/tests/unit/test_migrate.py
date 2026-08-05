import pytest
import sqlalchemy as sa

from fleetmanager.data_access.dbschema import Base
from fleetmanager.data_access.migrate import (
    KNOWN_STALE_REVISIONS,
    repair,
    resolve_stamped_revision,
)

# Arbitrary revision id - resolve_stamped_revision takes the known set as a
# parameter, so these tests are independent of the real migration chain.
OUR_REVISIONS = {"aaaa00000001"}


def make_engine():
    return sa.create_engine("sqlite://")


def make_version_table(engine, version=None):
    with engine.begin() as conn:
        conn.execute(
            sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
        )
        if version is not None:
            conn.execute(
                sa.text("INSERT INTO alembic_version VALUES (:v)"), {"v": version}
            )


def count_versions(engine):
    with engine.connect() as conn:
        return conn.execute(sa.text("SELECT COUNT(*) FROM alembic_version")).scalar()


def test_resolve_returns_known_revision():
    engine = make_engine()
    make_version_table(engine, "aaaa00000001")
    assert resolve_stamped_revision(engine, OUR_REVISIONS) == "aaaa00000001"
    assert count_versions(engine) == 1, "Known stamp must not be touched"


def test_resolve_returns_none_without_version_table():
    engine = make_engine()
    assert resolve_stamped_revision(engine, OUR_REVISIONS) is None


def test_resolve_returns_none_on_empty_version_table():
    engine = make_engine()
    make_version_table(engine)
    assert resolve_stamped_revision(engine, OUR_REVISIONS) is None


def test_resolve_deletes_known_stale_stamp():
    engine = make_engine()
    stale = next(iter(KNOWN_STALE_REVISIONS))
    make_version_table(engine, stale)
    assert resolve_stamped_revision(engine, OUR_REVISIONS) is None
    assert count_versions(engine) == 0, "Stale stamp should have been deleted"


def test_resolve_exits_on_unknown_stamp_and_touches_nothing():
    engine = make_engine()
    make_version_table(engine, "deadbeef1234")
    with pytest.raises(SystemExit):
        resolve_stamped_revision(engine, OUR_REVISIONS)
    assert count_versions(engine) == 1, "Unknown stamp must be left untouched"


def test_repair_creates_missing_tables_and_columns():
    engine = make_engine()
    # Simulate a legacy customer database: cars exists but lacks most columns,
    # and later-added tables (e.g. workshops) are missing entirely.
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE cars (id INTEGER PRIMARY KEY, imei VARCHAR(20),"
                " plate VARCHAR(128))"
            )
        )

    repair(engine)

    insp = sa.inspect(engine)
    model_tables = set(Base.metadata.tables.keys())
    assert model_tables.issubset(
        set(insp.get_table_names())
    ), "All model tables should exist after repair"

    car_columns = {col["name"] for col in insp.get_columns("cars")}
    model_columns = {col.name for col in Base.metadata.tables["cars"].columns}
    assert model_columns.issubset(car_columns), "All model columns should exist on cars"

    added = next(
        col for col in insp.get_columns("cars") if col["name"] == "external_id"
    )
    assert added["nullable"], "Repaired columns must be added as nullable"


def test_repair_is_a_noop_on_complete_schema():
    engine = make_engine()
    Base.metadata.create_all(engine)

    before = {
        table: [col["name"] for col in sa.inspect(engine).get_columns(table)]
        for table in sa.inspect(engine).get_table_names()
    }
    repair(engine)
    after = {
        table: [col["name"] for col in sa.inspect(engine).get_columns(table)]
        for table in sa.inspect(engine).get_table_names()
    }
    assert before == after, "Repair must not change a schema that matches the models"


def test_repair_is_idempotent():
    engine = make_engine()
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE cars (id INTEGER PRIMARY KEY)"))

    repair(engine)
    first = {col["name"] for col in sa.inspect(engine).get_columns("cars")}
    repair(engine)
    second = {col["name"] for col in sa.inspect(engine).get_columns("cars")}
    assert first == second, "Running repair twice must not change anything further"
