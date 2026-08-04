import os

import sqlalchemy
from sqlalchemy import create_engine, select, inspect, Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from .dbschema import (
    Base,
    FuelTypes,
    LeasingTypes,
    RoundTrips,
    SimulationSettings,
    VehicleTypes,
    get_default_fuel_types,
    get_default_leasing_types,
    get_default_simulation_settings,
    get_default_vehicle_types,
)

def build_dsn(
    db_name=None,
    db_password=None,
    db_user=None,
    db_url=None,
    db_server=None,
) -> str | None:
    """
    Builds the connection DSN from arguments or DB_* env variables.
    Returns None if any part is missing (callers fall back to SQLite).
    """
    db_name = db_name or os.getenv("DB_NAME")
    db_password = db_password or os.getenv("DB_PASSWORD")
    db_user = db_user or os.getenv("DB_USER")
    db_url = db_url or os.getenv("DB_URL")
    db_server = db_server or os.getenv("DB_SERVER")

    if not all((db_name, db_password, db_user, db_url, db_server)):
        return None

    dsn = f"{db_server}://{db_user}:{db_password}@{db_url}/{db_name}"
    if db_server == "mssql+pyodbc":
        dsn += "?driver=ODBC+Driver+17+for+SQL+Server"
    return dsn


def engine_creator(
    db_name=None,
    db_password=None,
    db_user=None,
    db_url=None,
    db_server=None,
) -> sqlalchemy.engine.Engine:
    """
    Generic db engine creator. Loads env variables, e.g. in .env otherwise could be passed with click.
    Ensures that tables according to dbschema is created before returning

    Parameters
    ----------
    db_name
    db_password
    db_user
    db_url

    Returns
    -------
    sqlalchemy.engine
    """
    dsn = build_dsn(db_name, db_password, db_user, db_url, db_server)
    if dsn is not None:
        db_engine = create_engine(
            dsn,
            pool_recycle=1800,
            # encoding="latin-1",
        )
    else:
        db_engine = create_engine(
            "sqlite:///file:fleetdb?mode=memory&cache=shared&uri=true",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            # encoding="latin-1",
        )

    insp = inspect(db_engine)
        
    if not insp.has_table("cars"):
        Base.metadata.create_all(db_engine)
        create_defaults(db_engine)

    return db_engine


def create_defaults(engine_: Engine) -> None:
    """
    Function to load in the defaults defined in dbschema
    """
    Session = sessionmaker(bind=engine_)
    with Session.begin() as sess:
        for vehicle_type in get_default_vehicle_types():
            if (
                len(
                    sess.execute(
                        select(VehicleTypes).where(VehicleTypes.id == vehicle_type.id)
                    ).all()
                )
                == 0
            ):
                sess.add(vehicle_type)

        for leasing_type in get_default_leasing_types():
            if (
                len(
                    sess.execute(
                        select(LeasingTypes).where(LeasingTypes.id == leasing_type.id)
                    ).all()
                )
                == 0
            ):
                sess.add(leasing_type)

        for fuel_type in get_default_fuel_types():
            if (
                len(
                    sess.execute(
                        select(FuelTypes).where(FuelTypes.id == fuel_type.id)
                    ).all()
                )
                == 0
            ):
                sess.add(fuel_type)

        for setting in get_default_simulation_settings():
            if (
                len(
                    sess.execute(
                        select(SimulationSettings).where(
                            SimulationSettings.id == setting.id
                        )
                    ).all()
                )
                == 0
            ):
                sess.add(setting)
