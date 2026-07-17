from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from fleetmanager.workshop import (
    add_workshop,
    delete_workshop,
    get_workshop_settings,
    get_workshop_visits,
    get_workshops,
    update_workshop,
    update_workshop_settings,
)

from ..dependencies import get_session
from .schemas import Workshop, WorkshopSettings, WorkshopVisit

router = APIRouter(prefix="/workshops")


@router.get("/settings", response_model=WorkshopSettings)
async def get_settings(session: Session = Depends(get_session)):
    """Get the global workshop settings."""
    return get_workshop_settings(session)


@router.patch("/settings", response_model=WorkshopSettings)
async def patch_settings(
    settings: WorkshopSettings,
    session: Session = Depends(get_session),
):
    """Update the global workshop settings."""
    return update_workshop_settings(session, settings.min_visit_hours)


@router.get("/workshop", response_model=list[Workshop])
async def get_workshop_info(
    session: Session = Depends(get_session),
    workshops: Optional[List[int]] = Query(None),
):
    """List registered workshops, optionally filtered by workshop ids."""
    return get_workshops(session, workshops=workshops)


@router.post("/workshop", response_model=Workshop)
async def create_new_workshop(
    new_workshop: Workshop,
    session: Session = Depends(get_session),
):
    """Create a new workshop."""
    return add_workshop(session, workshop_data=new_workshop)


@router.patch("/workshop", response_model=Workshop)
async def update_existing_workshop(
    known_workshop: Workshop,
    session: Session = Depends(get_session),
):
    """Update an existing workshop."""
    if known_workshop.id is None:
        raise HTTPException(
            status_code=422, detail="Workshop ID is required for update."
        )

    try:
        return update_workshop(session, known_workshop.id, known_workshop)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/workshop/{workshop_id}")
async def delete_existing_workshop(
    workshop_id: int,
    session: Session = Depends(get_session),
):
    """Delete a workshop and its registered visits."""
    deleted = delete_workshop(session, workshop_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=f"Workshop with ID {workshop_id} does not exist."
        )
    return {"deleted": True}


@router.get("/visits", response_model=list[WorkshopVisit])
async def get_visits(
    session: Session = Depends(get_session),
    workshops: Optional[List[int]] = Query(None),
    vehicles: Optional[List[int]] = Query(None),
    start_date: date | datetime = None,
    end_date: date | datetime = None,
):
    """List registered workshop visits filtered by workshop, vehicle and time range."""
    return get_workshop_visits(
        session,
        workshops=workshops,
        cars=vehicles,
        start_date=start_date,
        end_date=end_date,
    )
