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
    if db_name is None:
        db_name = os.getenv("DB_NAME")
    if db_password is None:
        db_password = os.getenv("DB_PASSWORD")
    if db_user is None:
        db_user = os.getenv("DB_USER")
    if db_url is None:
        db_url = os.getenv("DB_URL")
    if db_server is None:
        db_server = os.getenv("DB_SERVER")

    if all((db_name, db_password, db_user, db_url, db_server)):
        dsn = f"{db_server}://{db_user}:{db_password}@{db_url}/{db_name}"
        if db_server == "mssql+pyodbc":
            
            dsn += "?driver=ODBC+Driver+17+for+SQL+Server"
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
