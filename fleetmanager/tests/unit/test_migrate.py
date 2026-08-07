import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from fleetmanager.data_access.dbschema import Base
from fleetmanager.data_access.migrate import (
    ALEMBIC_INI,
    KNOWN_STALE_REVISIONS,
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


def run_migrations(engine, revision):
    """Run the chain up to a revision against an existing connection."""
    config = Config(str(ALEMBIC_INI))
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        try:
            command.upgrade(config, revision)
        finally:
            config.attributes.pop("connection", None)


def run_baseline(engine):
    config = Config(str(ALEMBIC_INI))
    baseline = ScriptDirectory.from_config(config).get_bases()[0]
    run_migrations(engine, baseline)


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


def test_resolve_exits_on_several_stamped_revisions():
    engine = make_engine()
    make_version_table(engine, "aaaa00000001")
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO alembic_version VALUES ('aaaa00000002')"))
    with pytest.raises(SystemExit):
        resolve_stamped_revision(engine, OUR_REVISIONS)
    assert count_versions(engine) == 2, "Nothing must be deleted"


def test_the_chain_builds_the_whole_schema_from_empty():
    engine = make_engine()

    run_migrations(engine, "head")

    tables = set(sa.inspect(engine).get_table_names())
    assert set(Base.metadata.tables).issubset(tables)


def test_baseline_fills_gaps_in_a_legacy_database():
    """
    A database created by the pre-Alembic create_all can be missing tables and
    columns added later. The baseline must add them without touching what is there.
    """
    engine = make_engine()
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE cars (id INTEGER PRIMARY KEY, imei VARCHAR(20),"
                " plate VARCHAR(128))"
            )
        )
        conn.execute(sa.text("INSERT INTO cars (imei, plate) VALUES ('1', 'AB12345')"))

    run_baseline(engine)

    insp = sa.inspect(engine)
    assert insp.has_table("workshops"), "Missing table should have been created"

    car_columns = {col["name"] for col in insp.get_columns("cars")}
    model_columns = {col.name for col in Base.metadata.tables["cars"].columns}
    assert model_columns.issubset(car_columns), "Missing columns should have been added"

    added = next(col for col in insp.get_columns("cars") if col["name"] == "location")
    assert added["nullable"], "Added columns must be nullable - old rows have no value"

    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT plate FROM cars")).scalars().all()
    assert rows == ["AB12345"], "Existing data must be left alone"


def test_baseline_creates_missing_indexes_on_existing_tables():
    engine = make_engine()
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE trips (id INTEGER PRIMARY KEY, car_id INTEGER NOT NULL,"
                " start_location INTEGER NOT NULL)"
            )
        )

    run_baseline(engine)

    indexes = {ix["name"] for ix in sa.inspect(engine).get_indexes("trips")}
    assert "ix_trips_car_id" in indexes
    assert "ix_trips_start_time" in indexes


def test_baseline_is_a_noop_on_a_complete_schema():
    engine = make_engine()
    Base.metadata.create_all(engine)
    before = {
        table: {col["name"] for col in sa.inspect(engine).get_columns(table)}
        for table in sa.inspect(engine).get_table_names()
    }

    run_baseline(engine)

    after = {
        table: {col["name"] for col in sa.inspect(engine).get_columns(table)}
        for table in sa.inspect(engine).get_table_names()
        if table != "alembic_version"
    }
    assert before == after, "Baseline must not change a schema that is already complete"
