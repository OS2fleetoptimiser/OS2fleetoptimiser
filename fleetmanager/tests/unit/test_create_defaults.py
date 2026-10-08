import sqlalchemy as sa

from fleetmanager.data_access.db_engine import create_defaults
from fleetmanager.data_access.dbschema import (
    Base,
    SimulationSettings,
    get_default_fuel_types,
    get_default_simulation_settings,
    get_default_vehicle_types,
)


def make_engine():
    engine = sa.create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return engine


def settings_by_name(engine):
    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT id, name FROM simulation_settings")).all()
    return {name: id_ for id_, name in rows}


def test_seeds_an_empty_database():
    engine = make_engine()

    create_defaults(engine)

    names = settings_by_name(engine)
    assert set(names) == {s.name for s in get_default_simulation_settings()}
    with engine.connect() as conn:
        assert conn.execute(sa.text("SELECT COUNT(*) FROM fuel_types")).scalar() == len(
            get_default_fuel_types()
        )
        assert conn.execute(
            sa.text("SELECT COUNT(*) FROM vehicle_types")
        ).scalar() == len(get_default_vehicle_types())


def test_is_idempotent():
    engine = make_engine()

    create_defaults(engine)
    first = settings_by_name(engine)
    create_defaults(engine)

    assert settings_by_name(engine) == first


def test_leaves_customer_values_alone():
    engine = make_engine()
    create_defaults(engine)
    with engine.begin() as conn:
        conn.execute(sa.text("UPDATE simulation_settings SET value='9.99' WHERE name='pris_el'"))

    create_defaults(engine)

    with engine.connect() as conn:
        value = conn.execute(
            sa.text("SELECT value FROM simulation_settings WHERE name='pris_el'")
        ).scalar()
    assert value == "9.99", "An existing setting must not be reset to its default"


def test_adds_settings_whose_default_id_is_taken_by_a_user_created_row():
    """
    Users create rows in simulation_settings through the app (vagt_<location>,
    name_fields), and those get auto ids in the same range as the defaults. A default
    whose id is taken must still be added, under whatever id the database hands out.
    """
    engine = make_engine()
    late_defaults = [s for s in get_default_simulation_settings() if s.id >= 19]
    assert late_defaults, "expected defaults with ids the app can reach"

    with engine.begin() as conn:
        for setting in late_defaults:
            conn.execute(
                sa.text(
                    "INSERT INTO simulation_settings (id, name, value, type)"
                    " VALUES (:id, :name, '[]', 'string')"
                ),
                {"id": setting.id, "name": f"vagt_{setting.id}"},
            )

    create_defaults(engine)

    names = settings_by_name(engine)
    for setting in late_defaults:
        assert setting.name in names, f"{setting.name} was skipped"
        assert names[setting.name] != setting.id, "should have been given a free id"
        assert names[f"vagt_{setting.id}"] == setting.id, "user row must be untouched"


def test_does_not_touch_rows_it_does_not_know():
    engine = make_engine()
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO simulation_settings (name, value, type)"
                " VALUES ('name_fields', '[]', 'list')"
            )
        )

    create_defaults(engine)

    assert "name_fields" in settings_by_name(engine)
