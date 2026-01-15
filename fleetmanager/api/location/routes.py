import os

from datetime import date, datetime

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from fleetmanager.location import (
    add_new_location,
    combine_allowed_start_precision,
    get_allowed_starts,
    get_location_precision,
    update_location_address,
    update_location_complete,
)

from fleetmanager.tasks import get_task_id, run_precision_location_test

from ..dependencies import get_session

from .schemas import (
    AllowedStart,
    ExtendedLocationInformation,
    LocationName,
    PrecisionTestIn,
    PrecisionTestOut,
    PrecisionTestOptions,
)
from fleetmanager.tasks.running_tasks import set_task_running, clear_task_signal

router = APIRouter(
    prefix="/locations"
)


@router.get("/precision", response_model=List[ExtendedLocationInformation])
async def location_precision(
    session: Session = Depends(get_session),
    start_date: date | datetime = None,
    end_date: date | datetime = None,
    locations: Optional[List[int]] = Query(None)
):
    """
    Get the location precision with extended information on the location. Car count, additional parking spots,
    kilometer recorded and roundtrip precision
    """
    location_information = get_allowed_starts(
        session,
        locations=locations,
    )
    precision_information = get_location_precision(
        session,
        locations=locations,
        start_date=start_date,
        end_date=end_date,
    )
    extended_information = combine_allowed_start_precision(
        location_information,
        precision_information
    )
    return extended_information


@router.get("/location", response_model=list[AllowedStart])
async def get_location_info(
    session: Session = Depends(get_session),
    locations: Optional[List[int]] = Query(None)
):
    """
    Create a new location with or without additional parking spots
    """
    location_information = get_allowed_starts(
        session,
        locations=locations,
    )

    return location_information


@router.post("/location", response_model=AllowedStart)
async def create_new_location(
    new_location: AllowedStart,
    session: Session = Depends(get_session),
):
    """
    Create a new location with or without additional parking spots
    """
    location = add_new_location(session, location_data=new_location)

    return location


@router.patch("/location", response_model=AllowedStart)
async def update_location(
    known_location: AllowedStart,
    session: Session = Depends(get_session),
):
    """
    Update an existing location with or without additional parking spots
    """
    if known_location.id is None:
        raise HTTPException(status_code=422, detail="Location ID is required for update.")

    location = update_location_complete(session, known_location.id, known_location)
    return location


@router.patch("/location/name", response_model=AllowedStart)
async def update_location_name(
    location_name_patch: LocationName,
    session: Session = Depends(get_session)
):
    updated_start = update_location_address(
        session,
        location_id=location_name_patch.location_id,
        address=location_name_patch.address
    )
    return updated_start


@router.post("/precision-test", response_model=PrecisionTestOut)
async def location_precision_test(
    precision_test_config: PrecisionTestIn,
):
    """
    Route to start a location precision test with new parking spots
    """
    test_name = f"precision_test_{precision_test_config.location}_{datetime.now().isoformat()}"
    set_task_running(test_name, "location")
    extractors = os.getenv("EXTRACTORS")
    extractors = [] if extractors is None else extractors.split(",")
    r = run_precision_location_test.apply_async(args=(
        PrecisionTestOptions(
            location=precision_test_config.location,
            test_specific_start=precision_test_config.test_specific_start,
            start_date=precision_test_config.start_date.replace(tzinfo=None),
            extractors=extractors,
            test_name=test_name
        ),
    ), task_id=get_task_id("precision_location"))
    return PrecisionTestOut(id=r.id, status=r.status, progress={"progress": 0, "test_name": test_name}, result=None)


@router.get("/precision-test/{precision_test_id}")
async def get_location_precision_test(
    precision_test_id: str
):
    """
    Get progress and result of precision test
    """
    r = AsyncResult(precision_test_id)
    if r.successful():
        result = r.get()
        progress = {"progress": 1, "test_name": None}
    elif r.info is not None:
        result = None
        progress = r.info
    else:
        result = None
        progress = {}
    return PrecisionTestOut(id=r.id, status=r.status, progress=progress, result=result)


@router.delete("/precision-test/{precision_test_id}")
async def delete_location_precision_test(
    precision_test_id: str
):
    r = AsyncResult(precision_test_id)
    if r.info is None:
        return {"task_terminating_on_next_iteration": False}
    clear_task_signal(r.info["test_name"], "location")
    return {"task_terminating_on_next_iteration": True}
