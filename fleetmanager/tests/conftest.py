from uuid import uuid4

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from fleetmanager.data_access.db_engine import create_defaults
from fleetmanager.data_access.dbschema import Base
from fleetmanager.data_access.seeding import (
    seed_allowed_starts,
    seed_cars,
    seed_dynamic_roundtrips_and_segments,
)


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        f"sqlite:///file:fleetdb_{uuid4().hex}?mode=memory&cache=shared&uri=true",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)
    create_defaults(engine)
    seed_allowed_starts(engine)
    seed_cars(engine)
    seed_dynamic_roundtrips_and_segments(engine)

    session = sessionmaker(autoflush=False, autocommit=False, bind=engine)()
    yield session
    session.close()
