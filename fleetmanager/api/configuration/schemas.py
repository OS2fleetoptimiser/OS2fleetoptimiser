from datetime import date, datetime, time, timedelta

from pydantic import BaseModel, Field, validator, root_validator
from typing import Literal, Union

from fleetmanager.data_access.dbschema import (
    vehicle_type_to_fuel,
    vehicle_type_to_wltp,
)


class Location(BaseModel):
    id: int | None = Field(example=1, description="ID of the location")
    address: str | None = Field(
        example="Njalsgade, 2300 København S", description="The address of the location"
    )


class FuelType(BaseModel):
    id: int | None = Field(
        example=1, description="The id to the fuel type of the vehicle"
    )
    name: str | None = Field(
        example="benzin", description="The name of the fuel type of the vehicle"
    )


class VehicleType(BaseModel):
    id: int | None = Field(
        example=4, description="The id to the vehicle type of the vehicle"
    )
    name: str | None = Field(
        example="fossilbil", description="The name of the vehicle type of the vehicle"
    )


class LeasingType(BaseModel):
    id: int | None = Field(
        example=1, description="The id to the leasing type of the vehicle"
    )
    name: str | None = Field(
        example="operationel", description="The name of the leasing type of the vehicle"
    )


class Vehicle(BaseModel):
    name: str | None
    range: float | None = Field(
        example=311,
        description="The range that a vehicle is capable of driving on one charge",
    )
    capacity_decrease: float | None = Field(
        example=23,
        description="The percentage decrease of the capacity of the "
        "battery to compensate for cold weather",
    )
    wltp_fossil: float | None = Field(
        example=19.8, description="km/l for fossil vehicles"
    )
    make: str | None = Field(example="Renault", description="The make of the vehicle")
    plate: str | None = Field(
        example="AB12345", description="Plate or registration of the vehicle"
    )
    start_leasing: Union[datetime, date] | None = Field(
        example="2022-01-01", description="Start leasing date"
    )
    end_leasing: Union[datetime, date] | None = Field(
        example="2026-01-01", description="End leasing date"
    )
    omkostning_aar: float | None = Field(
        example=39849.4, description="The yearly expense of the vehicle"
    )
    co2_pr_km: float | None = Field(example=140, description="CO2 gr emission pr km")
    wltp_el: float | None = Field(
        example=165.4, description="wh/km for electrical vehicles"
    )
    fuel: FuelType | None
    model: str | None = Field(example="Zoe", description="The model of the vehicle")
    km_aar: float | None = Field(
        example=30000, description="Yearly km allowance on the leasing contract"
    )
    sleep: int | None = Field(
        example=5, description="Minimum hour rest pr. charge for electrical vehicles"
    )
    id: int = Field(example=1, description="ID of the vehicle")
    location: Location | None
    deleted: bool | None = Field(
        example=False,
        description="Has the vehicle been deleted from the configuration.",
        default=False,
    )
    type: VehicleType | None
    department: str | None = Field(
        description="The department to which the car belongs. Free text for filtering cars "
        "in the frontend."
    )
    leasing_type: LeasingType | None
    disabled: bool | None = Field(
        example=False,
        description="Has the vehicle been disabled?",
        default=False,
    )
    imei: str | None = Field(
        example=12345678910111213141,
        description="The imei number of the GPS, only visible for Trackers/vehicles pulled from SkyHost",
        default=None,
    )
    description: str | None = Field(
        example="Bil nr. 27, Hjemmeplejen",
        description="Specific description for identifying the vehicle in FO. Mapping from extractor varies.",
        default=None
    )
    forvaltning: str | None = Field(
        example="TMF",
        description="Forvaltning if exists, hierarchy eq. forvaltning --> location --> department",
        default=None
    )
    test_vehicle: bool | None = Field(
        example=False,
        description="Is the vehicle a test vehicle created directly in the UI or a synced vehicle with data.",
        default=None
    )

    @root_validator(pre=True)
    def check_leasing_and_dates(cls, values):
        leasing_type = values.get("leasing_type")
        end_leasing = values.get("end_leasing")
        start_leasing = values.get("start_leasing")

        # convert dates to datetime if they are not None
        if end_leasing is not None and isinstance(end_leasing, date):
            end_leasing = datetime.combine(end_leasing, time(0, 0, 0))
            values["end_leasing"] = end_leasing

        if start_leasing is not None and isinstance(start_leasing, date):
            start_leasing = datetime.combine(start_leasing, time(0, 0, 0))
            values["start_leasing"] = start_leasing

        # now do the leasing type check
        if (
            leasing_type is not None
            and type(leasing_type) is dict
            and leasing_type.get("id") in [1, 2]
        ) or (
            leasing_type is not None
            and type(leasing_type) is LeasingType
            and leasing_type.id in [1, 2]
        ):
            if end_leasing is None:
                raise ValueError(
                    f'9.end leasing not entered for leasing type "operationel" or "finansiel"'
                )
        return values

    @validator("type")
    def correct_wltp_fuel_must_be_filled(cls, v, values):
        if v is not None and v.id is not None:
            # hvis vehicle type er indtastet findes den rigtige WLTP type
            # elbil: wltp_el, fossilbil: wltp_fossil
            wltp_type = vehicle_type_to_wltp[v.id]
            if wltp_type is not None:
                switch = ["wltp_el", "wltp_fossil"]
                switch.pop(switch.index(wltp_type))
                # hvis den rigtige wltp_type ikke er udfyldt kan vi ikke gemme
                if (
                    values.get(wltp_type) is None
                    and values.get("omkostning_aar") is not None
                ):
                    raise ValueError(
                        f'0.{wltp_type} is not filled for type "{v}" which is mandatory'
                    )
                # hvis den forkerte er udfyldt kan der ikke gemmes
                if (
                    values.get(switch[0]) is not None
                    and values.get("omkostning_aar") is not None
                ):
                    raise ValueError(
                        f'1.{switch[0]} is filled for type "{v}", which is not allowed, should be null/None'
                    )

            # hvis fuel ikke er udfyldt kan der ikke gemmes
            if values["fuel"] is None or values["fuel"].id is None:
                raise ValueError(
                    f'2.fuel is not entered, with type "{v}", fuel id should be: {vehicle_type_to_fuel[v.id]}'
                )

            # hvis den forkerte fuel er valgt ift. hvilken vehicle type der er valgt
            # cykel & elcykel: 10 (bike)
            # elbil: 3, 7, 8, (el, elctric3, electric)
            # fossilbil: 1, 2, 4, 5, 6, 9 (benzin, diesel, hybrid, plugin hybrid benzin/diesel, petrol)
            if values["fuel"].id not in vehicle_type_to_fuel[v.id]:
                raise ValueError(
                    f'3.fuel type for type "{v}" is wrong, fuel id should be: {vehicle_type_to_fuel[v.id]}'
                )

            if wltp_type is None and any(
                [values["wltp_el"] is not None, values["wltp_fossil"] is not None]
            ):
                raise ValueError(
                    f'4.fuel type for type "{v}" should be empty "wltp_el" & "wltp_fossil"'
                )

        return v


class VehicleInput(Vehicle):
    """vehicles created through API is assigned an id to avoid duplicates on ids from extractors"""

    id: int | None = Field(
        description="id will be automatically assigned and should not be entered"
    )


class VehiclesList(BaseModel):
    vehicles: list[Vehicle]


class ConfigurationTypes(BaseModel):
    locations: list[Location]
    vehicle_types: list[VehicleType]
    leasing_types: list[LeasingType]
    fuel_types: list[FuelType]
    departments: list[str | None]


class BikeSlot(BaseModel):
    bike_start: time = Field(
        example="08:00",
        description="The beginning of the period where bikes can accept trips",
    )
    bike_end: time = Field(
        example="15:00",
        description="The end of the period where bikes can accept trips",
    )


class BikeSettings(BaseModel):
    max_km_pr_trip: int | None = Field(
        example=10, description="The max allowed distance pr trip for a bike"
    )
    percentage_of_trips: int | None = Field(
        example=50,
        description="Percentage of the qualified bike trips that " "should be accepted",
    )
    bike_slots: list[BikeSlot] | None
    bike_speed: int | None = Field(
        example=8,
        description="The speed that a bike is able to ride at in order to accept a roundtrip"
    )
    electrical_bike_speed: int | None = Field(
        example=12,
        description="The speed that an electrical bike is able to ride at in order to accept a roundtrip"
    )

    @validator("percentage_of_trips")
    def percentage_range(cls, v):
        if v is not None:
            if 0 > v or v > 100:
                raise ValueError("percentage_of_trips should be between 0 and 100")
            return v
        else:
            return 100

    @validator("max_km_pr_trip")
    def max_trip(cls, v):
        if v is None:
            return 10
        return v


class Shift(BaseModel):
    shift_start: time | None = Field(example="07:00", description="Start time of shift")
    shift_end: time | None = Field(example="15:00", description="End time of shift")
    shift_break: time | None = Field(
        example="11:00", description="Approximate time of break during the shift"
    )


class LocationShifts(BaseModel):
    address: str | None = Field(description="The address name of the location")
    location_id: int = Field(
        example=1, description="The location id of which the shifts belong"
    )
    shifts: list[Shift] | None

    @validator("shifts")
    def shift_validation(cls, v):
        if len(v) == 0:
            return v
        vagt_starts = [shift.shift_start for shift in v]
        vagt_ends = [shift.shift_end for shift in v]
        vagt_pause = [shift.shift_break for shift in v]

        starts = [False] * len(vagt_starts)
        ends = [False] * len(vagt_ends)
        pause = [False] * len(vagt_pause)

        start_times = [
            # time(hour=int(slot.split(":")[0]), minute=int(slot.split(":")[-1]))
            slot
            for slot in vagt_starts
        ]
        end_times = [
            # time(hour=int(slot.split(":")[0]), minute=int(slot.split(":")[-1]))
            slot
            for slot in vagt_ends
        ]
        breaktimes = [
            None if slot is None or slot == "" else slot
            # else time(hour=int(slot.split(":")[0]), minute=int(slot.split(":")[-1]))
            for slot in vagt_pause
        ]

        # tjek at alle 24 timer er i brug
        if start_times[0] != end_times[-1]:
            starts[0] = True
            ends[-1] = True

        fixed_starts = []
        fixed_ends = []
        for k, (s, e, p) in enumerate(zip(start_times, end_times, breaktimes)):
            if p is not None and p != "":
                p = datetime.combine(date(1, 1, 1), p)
            if e < s:
                s = datetime.combine(date(1, 1, 1), s)
                e = datetime.combine(date(1, 1, 2), e)
                if p is not None and not s < p < e:
                    p += timedelta(days=1)
            else:
                s = datetime.combine(date(1, 1, 1), s)
                e = datetime.combine(date(1, 1, 1), e)

            # tjek pause er inden for start og slut
            if p is not None and p != "" and not s < p < e:
                pause[k] = True

            fixed_starts.append(s)
            fixed_ends.append(e)

        # tjek at der ingen overlap er
        for k, (s, e) in enumerate(zip(fixed_starts, fixed_ends)):
            if k + 1 == len(fixed_starts):
                index = 0
            else:
                index = k + 1

            if e < s:
                starts[k] = True
                ends[k] = True
            elif fixed_starts[index].time() < e.time() and index != 0:
                ends[k] = True
                starts[index] = True
            elif fixed_starts[index].time() != e.time():
                ends[k] = True
                starts[index] = True

        if any(starts + ends + pause):
            raise ValueError(
                f"The shifts: {v} are not accepted. Check that all 24 hours are in use and that there are"
                f" not overlaps in the shifts."
            )

        return v


class SimulationSettings(BaseModel):
    el_udledning: float | None = Field(
        example=0.09, description="Emission of electrical usage"
    )
    benzin_udledning: float | None = Field(
        example=2.52, description="Emission of one liter benzin"
    )
    diesel_udledning: float | None = Field(
        example=2.98, description="Emission of one liter diesel"
    )
    hvo_udledning: float | None = Field(
        example=0.894, description="Emission of one liter hvo"
    )
    pris_el: float | None = Field(example=2.13, description="Price of one kwh")
    pris_benzin: float | None = Field(
        example=12.33, description="Price of one liter benzin"
    )
    pris_diesel: float | None = Field(
        example=10.83, description="Price of one liter diesel"
    )
    pris_hvo: float | None = Field(
        example=19.84, description="Price of one liter hvo"
    )
    vaerdisaetning_tons_co2: int | None = Field(
        example=750, description="Expense of emitting 1 ton of CO2e"
    )
    sub_time: int | None = Field(
        example=5,
        description="Minimum rest period for vehicle before being able "
        "to accept a new trip",
    )
    high: float | None = Field(
        example=2.17,
        description="The compensation payed out for unallocated trips. Pr. km. when "
        "distance_threshold has been reached.",
    )
    low: float | None = Field(
        example=3.7,
        description="The compensation payed out for unallocated trips. Pr. km. before the "
        "distance_threshold has been reached.",
    )
    distance_threshold: int | None = Field(
        example=20000,
        description="The threshold defining when high and low compensation "
        "should be payed",
    )
    undriven_type: Literal["benzin", "diesel", "el", "hvo"] | None = Field(
        example="benzin",
        description="The type of car allocated" "to the unallocated trips",
    )
    undriven_wltp: float | None = Field(
        example=20, description="WLTP for the undriven type"
    )
    keep_data: int | None = Field(
        example=24,
        description="Months to keep the roundtrips. Data that exceeds this date will "
        "be deleted",
    )
    slack: int | None = Field(
        example=5,
        description="Amount of allowed unallocated trips accepted in Tabu search",
    )
    max_undriven: int | None = Field(
        example=25,
        description="Maximum distance of the allowed unallocated trips in "
        "Tabu search",
    )


class SimulationConfiguration(BaseModel):
    shift_settings: list[LocationShifts] | None
    bike_settings: BikeSettings | None
    simulation_settings: SimulationSettings | None
