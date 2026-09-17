from datetime import datetime, date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
import logging
import os
from sqlalchemy.orm import Session

from fleetmanager.configuration import (
    create_single_vehicle,
    delete_single_vehicle,
    get_all_configurations_from_db,
    get_dropdown_data,
    get_single_vehicle,
    get_vehicles,
    save_all_configurations,
    update_single_vehicle,
    validate_settings,
    move_vehicle,
    validate_vehicle_metadata,
)

from fleetmanager.configuration.util import update_vehicle_metadata
from fleetmanager.model.exceptions import (
    MetadataColumnError,
    MetadataFileError,
    MetadataRowInvalidError,
)

from datetime import date

from ..dependencies import get_session
from ..simulation_setup.schemas import Location
from .schemas import (
    ConfigurationTypes,
    FuelType,
    LeasingType,
    SimulationConfiguration,
    Vehicle,
    VehicleInput,
    VehiclesList,
    VehicleType,
)

router = APIRouter(
    prefix="/configuration",
)

logger = logging.getLogger(__name__)


@router.get("/vehicles", response_model=VehiclesList)
async def get_all_vehicles(session: Session = Depends(get_session)):
    """
    Get all the vehicles in the database for the configuration view. Returns all vehicle attributes.
    """

    vehicles = VehiclesList(
        vehicles=[Vehicle(**vehicle) for vehicle in get_vehicles(session)]
    )

    return vehicles


@router.get("/dropdown-data", response_model=ConfigurationTypes)
async def dropdown_data(session: Session = Depends(get_session)):
    """
    Get the key value pairs for populating the dropdowns in the configuration. Will serve type (vehicle type),
    fuel, leasing type and locations.
    """
    vehicle_types, fuel_types, leasing_types, locations, departments = (
        get_dropdown_data(session)
    )
    configuration_types = ConfigurationTypes(
        locations=[Location(id=entry.id, address=entry.address) for entry in locations],
        vehicle_types=[
            VehicleType(id=entry.id, name=entry.name) for entry in vehicle_types
        ],
        leasing_types=[
            LeasingType(id=entry.id, name=entry.name) for entry in leasing_types
        ],
        fuel_types=[FuelType(id=entry.id, name=entry.name) for entry in fuel_types],
        departments=[dep.department for dep in departments],
    )

    return configuration_types


@router.get("/vehicle/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: int, session: Session = Depends(get_session)):
    response = get_single_vehicle(session, vehicle_id)
    if response is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle does not exist")
    return Vehicle(**response)


@router.patch("/vehicle")
async def update_vehicle(
    vehicle_object: Vehicle, session: Session = Depends(get_session)
):
    """
    Update a single vehicle from the configuration page. BE AWARE: Should include all values that should persist to
    allow removal of attributes no longer relevant or wrongly input. Hence, all values that are null, will be changed
    on the vehicle attribute as well.
    """
    if isinstance(vehicle_object.start_leasing, date):
        vehicle_object.start_leasing = datetime(
            vehicle_object.start_leasing.year,
            vehicle_object.start_leasing.month,
            vehicle_object.start_leasing.day,
        )

    if isinstance(vehicle_object.end_leasing, date):
        vehicle_object.end_leasing = datetime(
            vehicle_object.end_leasing.year,
            vehicle_object.end_leasing.month,
            vehicle_object.end_leasing.day,
        )

    response = update_single_vehicle(session, vehicle_object)

    if response != "ok":
        raise HTTPException(status.HTTP_404_NOT_FOUND, response)

    return {"success": True}


@router.post("/vehicle")
async def create_vehicle(
    vehicle_object: VehicleInput, session: Session = Depends(get_session)
):
    """
    Create a single vehicle from the configuration page.
    """
    if isinstance(vehicle_object.start_leasing, date):
        vehicle_object.start_leasing = datetime(
            vehicle_object.start_leasing.year,
            vehicle_object.start_leasing.month,
            vehicle_object.start_leasing.day,
        )

    if isinstance(vehicle_object.end_leasing, date):
        vehicle_object.end_leasing = datetime(
            vehicle_object.end_leasing.year,
            vehicle_object.end_leasing.month,
            vehicle_object.end_leasing.day,
        )
    response = create_single_vehicle(session, vehicle_object)
    if type(response) != int:
        raise HTTPException(status.HTTP_404_NOT_FOUND, response)

    return {"id": response}


@router.delete("/vehicle/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, session: Session = Depends(get_session)):
    """
    Delete a vehicle and it's associated roundtrips from the database.
    Deleting a vehicle will include its id in the simulation settings banned cars list, referenced
    by the data job.
    """
    # todo add response model
    response = delete_single_vehicle(session, vehicle_id)

    return {"success": True}


def split_validation(validation: dict[int, str]):
    """
    Split the per row validation messages into the three buckets the frontend renders.
    """
    valid = []
    error = []
    ignore = []
    for k, v in validation.items():
        out = {"row": k, "msg": v}
        if v == "ok":
            valid.append(out)
        if v.startswith("Fejl"):
            error.append(out)
        if v.startswith("Ignore"):
            ignore.append(out)

    return valid, error, ignore


@router.post("/vehicles/metadata")
async def vehicles_validate_metadata(
    validationonly: bool = False,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Validate, and unless validationonly is set, persist an uploaded xlsx of vehicle metadata.

    Every rejection carries an "error" code in the response detail, along with the specifics
    the user needs to correct the file; the received content type, the mismatching column
    names or the offending rows.
    """
    # check payload
    valid_mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if file.content_type != valid_mimetype:
        logger.warning(
            "Metadata upload rejected, unexpected content type. filename=%s content_type=%s",
            file.filename,
            file.content_type,
        )
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": "invalid_mimetype",
                "filename": file.filename,
                "content_type": file.content_type,
                "expected_content_type": valid_mimetype,
            },
        )

    # process payload
    contents = await file.read()
    try:
        validation, vehicles = validate_vehicle_metadata(session, contents)
    except MetadataColumnError as e:
        logger.warning(
            "Metadata upload rejected, column mismatch. filename=%s missing=%s unexpected=%s",
            file.filename,
            e.missing_columns,
            e.unexpected_columns,
        )
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_columns",
                "missing_columns": e.missing_columns,
                "unexpected_columns": e.unexpected_columns,
            },
        )
    except MetadataFileError as e:
        logger.warning(
            "Metadata upload rejected, file could not be parsed. filename=%s reason=%s",
            file.filename,
            e.reason,
        )
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": "unreadable_file",
                "filename": file.filename,
                "reason": e.reason,
            },
        )

    valid, error, ignore = split_validation(validation)

    if validationonly:
        return {"valid": valid, "errors": error, "ignores": ignore}

    try:
        total_updated = update_vehicle_metadata(session, validation, vehicles)
    except MetadataRowInvalidError as e:
        logger.warning(
            "Metadata upload rejected, %s of %s rows invalid. filename=%s",
            len(error),
            len(validation),
            file.filename,
        )
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_rows",
                "data": validation,
                "errors": error,
                "ignores": ignore,
            },
        )

    return {"total_updated": total_updated}


# get the bike configuration
@router.get("/simulation-configurations", response_model=SimulationConfiguration)
async def get_all_configurations(session: Session = Depends(get_session)):
    """
    Get all the configuration settings exposed in the UI, which the user can change.
    """
    settings = get_all_configurations_from_db(session)
    simulation_config = validate_settings(settings)

    return simulation_config


@router.patch("/update-configurations")
async def update_configurations(
    settings: SimulationConfiguration, session: Session = Depends(get_session)
):
    """
    Update any of the 3 types of settings with this patch; simulation_settings, bike_settings or shift_settings.
    null values of the simulation_settings will not be set as opposed to the two other objects; bike_settings and
    shift_settings.
    """
    # todo add response model
    explicit_settings = settings.dict(exclude_unset=True)
    if explicit_settings:
        save_all_configurations(session, explicit_settings)
    return {"success": True}


@router.patch("/move-vehicle")
async def update_vehicle_roundtrips(
    vehicle_id: int,
    from_date: datetime | date,
    to_location: int | None = None,
    disable: bool = False,
    session: Session = Depends(get_session),
):
    """
    Endpoint to change a vehicle's roundtrips historically. Say a vehicle have changed location weeks back, one wants
    to make sure that these roundtrips are attributed to the correct location. For whenever the fleetmanagement system
    does not expose the vehicles home location, this endpoint can be used to change the:
    * location of the vehilce
    * start_location_id of the roundtrips driven by vehicle_id after from_date

    or:

    * disable the vehicle such that no further roundtrips will be pulled and aggregated
    * delete roundtrips driven by vehicle_id after from_date
    """
    move_vehicle(
        session=session,
        vehicle_id=vehicle_id,
        from_date=from_date,
        to_location=to_location,
        delete=disable,
    )
    return {"success": True}
