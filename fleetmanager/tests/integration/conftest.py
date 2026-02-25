import pytest
from sqlalchemy import StaticPool, create_engine

from fleetmanager.data_access.db_engine import create_defaults
from fleetmanager.data_access.dbschema import Base
from fleetmanager.data_access.seeding import seed_db


@pytest.fixture(scope="session", autouse=True)
def seed_shared_db():
    """Seed the shared in-memory SQLite DB used by fleet_simulator and goal_simulator."""
    engine = create_engine(
        "sqlite:///file:fleetdb?mode=memory&cache=shared&uri=true",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    create_defaults(engine)
    seed_db(engine)
    yield
    engine.dispose()
