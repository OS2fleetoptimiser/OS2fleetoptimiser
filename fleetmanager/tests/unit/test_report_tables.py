from datetime import datetime

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from fleetmanager.data_access.dbschema import (
    AllowedStarts,
    Base,
    Cars,
    ReportAlerts,
    ReportDeliveries,
    ReportRecipients,
    ReportSubscriptionScope,
    ReportSubscriptions,
)


@pytest.fixture
def session():
    """
    In-memory database with foreign keys enforced. SQLite ignores them by default,
    and without them the cascade and blocking rules below would pass for the wrong reason.
    """
    engine = sa.create_engine("sqlite://")

    @sa.event.listens_for(engine, "connect")
    def enforce_foreign_keys(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as sess:
        yield sess


def make_subscription(sess, name="Døde biler Nord", **kwargs):
    kwargs.setdefault("trigger_type", "dead_vehicle")
    kwargs.setdefault("schedule", "0 6 * * *")
    kwargs.setdefault("created_by", "keycloak-sub-abc123")
    subscription = ReportSubscriptions(name=name, **kwargs)
    sess.add(subscription)
    sess.flush()
    return subscription


def make_car(sess):
    location = AllowedStarts(address="Plejecenter Nord", latitude=56.1, longitude=10.2)
    sess.add(location)
    sess.flush()
    car = Cars(plate="AB12345", location=location.id)
    sess.add(car)
    sess.flush()
    return car, location


def test_a_subscription_holds_together_across_all_five_tables(session):
    car, location = make_car(session)
    subscription = make_subscription(session, threshold_days=5)
    session.add_all(
        [
            ReportSubscriptionScope(
                subscription_id=subscription.id, location_id=location.id
            ),
            ReportRecipients(
                subscription_id=subscription.id,
                email="anne@kommune.dk",
                name="Anne Hansen",
            ),
        ]
    )
    alert = ReportAlerts(subscription_id=subscription.id, car_id=car.id)
    session.add(alert)
    session.flush()
    session.add(
        ReportDeliveries(
            subscription_id=subscription.id,
            alert_id=alert.id,
            recipient_email="anne@kommune.dk",
            subject="Bil AB12345 har ikke kørt siden 28. juli",
            status="sent",
        )
    )
    session.commit()

    for model in (
        ReportSubscriptions,
        ReportSubscriptionScope,
        ReportRecipients,
        ReportAlerts,
        ReportDeliveries,
    ):
        assert session.execute(sa.select(sa.func.count()).select_from(model)).scalar() == 1


def test_a_new_subscription_is_active_and_watches_nothing(session):
    subscription = make_subscription(session)

    assert subscription.active is True
    assert subscription.deleted is False
    assert subscription.all_vehicles is False, "whole fleet must be an explicit choice"
    assert subscription.threshold_days is None
    assert subscription.last_run is None, "never run yet, so the dispatcher sees it as due"
    assert subscription.created_at is not None
    assert subscription.updated_at is not None


def test_a_new_alert_is_open(session):
    car, _ = make_car(session)
    subscription = make_subscription(session)

    alert = ReportAlerts(subscription_id=subscription.id, car_id=car.id)
    session.add(alert)
    session.flush()

    assert alert.status == "open"
    assert alert.opened_at is not None
    assert alert.resolved_at is None
    assert alert.resolved_by_user is None
    assert alert.last_activity is None, "the evaluator fills this in, not the model"


def test_the_same_recipient_cannot_be_added_twice(session):
    subscription = make_subscription(session)
    session.add(
        ReportRecipients(subscription_id=subscription.id, email="anne@kommune.dk")
    )
    session.flush()

    session.add(
        ReportRecipients(subscription_id=subscription.id, email="anne@kommune.dk")
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_the_same_recipient_can_be_on_two_subscriptions(session):
    first = make_subscription(session, name="Døde biler Nord")
    second = make_subscription(session, name="Døde biler Syd")

    session.add_all(
        [
            ReportRecipients(subscription_id=first.id, email="anne@kommune.dk"),
            ReportRecipients(subscription_id=second.id, email="anne@kommune.dk"),
        ]
    )
    session.flush()

    assert (
        session.execute(
            sa.select(sa.func.count()).select_from(ReportRecipients)
        ).scalar()
        == 2
    )


def test_deleting_a_subscription_takes_its_configuration_with_it(session):
    _, location = make_car(session)
    subscription = make_subscription(session)
    session.add_all(
        [
            ReportSubscriptionScope(
                subscription_id=subscription.id, location_id=location.id
            ),
            ReportRecipients(subscription_id=subscription.id, email="anne@kommune.dk"),
        ]
    )
    session.commit()

    session.execute(
        sa.text("DELETE FROM report_subscriptions WHERE id = :id"),
        {"id": subscription.id},
    )
    session.commit()

    for model in (ReportSubscriptionScope, ReportRecipients):
        assert (
            session.execute(sa.select(sa.func.count()).select_from(model)).scalar() == 0
        ), f"{model.__tablename__} should have been removed with the subscription"


def test_deleting_a_subscription_with_history_is_blocked(session):
    """
    Alerts and deliveries are history and must survive, which is why subscriptions are
    soft-deleted with the `deleted` flag instead of removed.
    """
    car, _ = make_car(session)
    subscription = make_subscription(session)
    session.add(ReportAlerts(subscription_id=subscription.id, car_id=car.id))
    session.commit()

    with pytest.raises(IntegrityError):
        session.execute(
            sa.text("DELETE FROM report_subscriptions WHERE id = :id"),
            {"id": subscription.id},
        )
        session.commit()


def test_editing_a_subscription_moves_updated_at(session):
    subscription = make_subscription(session)
    session.commit()
    subscription.updated_at = datetime(2020, 1, 1)
    session.commit()

    subscription.name = "Døde biler Syd"
    session.commit()

    assert subscription.updated_at > datetime(2020, 1, 1), "onupdate should have fired"
    assert subscription.created_at != subscription.updated_at
