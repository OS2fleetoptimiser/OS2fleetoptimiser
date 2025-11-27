from datetime import date
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    Query,
)
from sqlalchemy.orm import Session

from fleetmanager.simulation_setup import (
    get_location_vehicles,
    get_location_vehicles_loc,
    get_locations,
    get_forvaltninger
)

from ..dependencies import get_session
from .schemas import Locations, LocationsVehicleList

router = APIRouter(
    prefix="/simulation-setup",
)


@router.get("/locations-vehicles", response_model=LocationsVehicleList)
async def locations_vehicles(
    start_date: date,
    end_date: date,
    locations: Optional[List[int]] = Query(None),
    forvaltning: Optional[str] = Query(None),
    session: Session = Depends(get_session),
) -> LocationsVehicleList:
    """
    Get one or all locations and their associated vehicles.
    Used when selecting a location on page setup.
    """

    if locations:
        location_vehicles = []
        for location in locations:
            # pooling (consider as one) happens in the function , hence we iterate locations list
            location_vehicles += get_location_vehicles_loc(
                session,
                start_date,
                end_date,
                [location],
                forvaltning
            ).locations

        result = LocationsVehicleList(locations=location_vehicles)
    else:
        result = get_location_vehicles(session, start_date, end_date)

    return result


@router.get("/locations", response_model=Locations)
async def api_locations(session: Session = Depends(get_session)) -> Locations:
    """
    Get a list of all the locations.
    Used initially on the setup page.
    """
    return get_locations(session)


@router.get("/forvaltninger")
async def api_forvaltninger(session: Session = Depends(get_session)):
    """
    Get an object of forvaltninger to locations.
    Used initially on the setup page.
    """
    return get_forvaltninger(session)
