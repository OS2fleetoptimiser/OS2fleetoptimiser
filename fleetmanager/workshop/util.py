from datetime import date, datetime

from sqlalchemy.orm import Session

from fleetmanager.api.workshop.schemas import Workshop, WorkshopSettings, WorkshopVisit
from fleetmanager.data_access import Cars, SimulationSettings, Workshops, WorkshopVisits

WORKSHOP_MIN_HOURS_SETTING = "workshop_visit_min_hours"
DEFAULT_MIN_VISIT_HOURS = 4.0


def get_workshop_settings(session: Session) -> WorkshopSettings:
    """Return the global workshop settings (minimum visit duration)."""
    setting = (
        session.query(SimulationSettings)
        .filter(SimulationSettings.name == WORKSHOP_MIN_HOURS_SETTING)
        .first()
    )
    value = DEFAULT_MIN_VISIT_HOURS
    if setting is not None:
        try:
            value = float(setting.value)
        except (TypeError, ValueError):
            pass
    return WorkshopSettings(min_visit_hours=value)


def update_workshop_settings(
    session: Session, min_visit_hours: float
) -> WorkshopSettings:
    """Update the global minimum visit duration setting."""
    setting = (
        session.query(SimulationSettings)
        .filter(SimulationSettings.name == WORKSHOP_MIN_HOURS_SETTING)
        .first()
    )
    if setting is None:
        session.add(
            SimulationSettings(
                id=None,
                name=WORKSHOP_MIN_HOURS_SETTING,
                value=str(min_visit_hours),
                type="float",
            )
        )
    else:
        setting.value = str(min_visit_hours)
    session.commit()
    return WorkshopSettings(min_visit_hours=min_visit_hours)


def _to_schema(workshop: Workshops) -> Workshop:
    return Workshop(
        id=workshop.id,
        name=workshop.name,
        address=workshop.address,
        latitude=workshop.latitude,
        longitude=workshop.longitude,
        addition_date=workshop.addition_date,
    )


def get_workshops(
    session: Session,
    workshops: None | list[int] = None,
) -> list[Workshop]:
    """Return all registered workshops, optionally filtered by a list of ids."""
    query = session.query(Workshops)
    if workshops:
        query = query.filter(Workshops.id.in_(workshops))

    return [_to_schema(workshop) for workshop in query.all()]


def add_workshop(session: Session, workshop_data: Workshop) -> Workshop:
    """Create a new workshop."""
    new_workshop = Workshops(
        name=workshop_data.name,
        address=workshop_data.address,
        latitude=workshop_data.latitude,
        longitude=workshop_data.longitude,
        addition_date=workshop_data.addition_date or datetime.now(),
    )

    session.add(new_workshop)
    session.commit()
    session.refresh(new_workshop)

    return _to_schema(new_workshop)


def update_workshop(
    session: Session, workshop_id: int, update_data: Workshop
) -> Workshop:
    """Update the fields of an existing workshop."""
    workshop = session.query(Workshops).get(workshop_id)
    if not workshop:
        raise ValueError(f"Workshop with ID {workshop_id} does not exist.")

    if update_data.name is not None:
        workshop.name = update_data.name
    if update_data.address is not None:
        workshop.address = update_data.address
    if update_data.latitude is not None:
        workshop.latitude = update_data.latitude
    if update_data.longitude is not None:
        workshop.longitude = update_data.longitude

    session.commit()
    session.refresh(workshop)

    return _to_schema(workshop)


def delete_workshop(session: Session, workshop_id: int) -> bool:
    """Delete a workshop and its visits. Returns False if it did not exist."""
    workshop = session.query(Workshops).get(workshop_id)
    if not workshop:
        return False

    session.query(WorkshopVisits).filter(
        WorkshopVisits.workshop_id == workshop_id
    ).delete(synchronize_session=False)
    session.delete(workshop)
    session.commit()
    return True


def get_workshop_visits(
    session: Session,
    workshops: None | list[int] = None,
    cars: None | list[int] = None,
    start_date: None | date | datetime = None,
    end_date: None | date | datetime = None,
) -> list[WorkshopVisit]:
    """Return workshop visits with workshop and car info, filtered as given."""
    query = (
        session.query(
            WorkshopVisits.id,
            WorkshopVisits.car_id,
            WorkshopVisits.workshop_id,
            WorkshopVisits.start_time,
            WorkshopVisits.end_time,
            WorkshopVisits.duration,
            Workshops.name.label("workshop_name"),
            Workshops.address.label("workshop_address"),
            Cars.plate.label("plate"),
        )
        .join(Workshops, Workshops.id == WorkshopVisits.workshop_id)
        .join(Cars, Cars.id == WorkshopVisits.car_id)
    )

    if workshops:
        query = query.filter(WorkshopVisits.workshop_id.in_(workshops))
    if cars:
        query = query.filter(WorkshopVisits.car_id.in_(cars))
    if start_date:
        query = query.filter(WorkshopVisits.start_time >= start_date)
    if end_date:
        query = query.filter(WorkshopVisits.end_time <= end_date)

    query = query.order_by(WorkshopVisits.start_time.desc())

    return [
        WorkshopVisit(
            id=visit.id,
            car_id=visit.car_id,
            workshop_id=visit.workshop_id,
            workshop_name=visit.workshop_name,
            workshop_address=visit.workshop_address,
            plate=visit.plate,
            start_time=visit.start_time,
            end_time=visit.end_time,
            duration=visit.duration,
        )
        for visit in query.all()
    ]
