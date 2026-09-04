import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from fleetmanager.data_access.dbschema import Base, Cars
from fleetmanager.extractors.util import save_vehicle


def _session():
    # in-memory sqlite, StaticPool so create_all + the session share one connection
    engine = sa.create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def test_inserts_new_vehicle_with_db_assigned_id():
    s = _session()
    save_vehicle({"external_id": "imei-1", "source": "skyhost", "plate": "AB12345"}, s)

    car = s.query(Cars).one()
    assert car.external_id == "imei-1"
    assert car.source == "skyhost"
    assert car.id is not None  # assigned by the database, not by us


def test_updates_existing_match_on_external_id_and_source():
    s = _session()
    save_vehicle({"external_id": "imei-1", "source": "skyhost", "plate": "AB12345"}, s)
    first_id = s.query(Cars).one().id

    # same (external_id, source), new plate -> should update, not create a duplicate
    save_vehicle({"external_id": "imei-1", "source": "skyhost", "plate": "XY99999"}, s)

    cars = s.query(Cars).all()
    assert len(cars) == 1
    assert cars[0].id == first_id
    assert cars[0].plate == "XY99999"


def test_same_external_id_different_source_are_distinct_cars():
    s = _session()
    save_vehicle({"external_id": "5", "source": "skyhost"}, s)
    save_vehicle({"external_id": "5", "source": "puma"}, s)

    # same external id but different vendor -> two distinct cars
    assert s.query(Cars).count() == 2
