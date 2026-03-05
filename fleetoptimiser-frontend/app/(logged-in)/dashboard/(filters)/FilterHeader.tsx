'use client';

import dayjs, { Dayjs } from 'dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, {useEffect, useState} from 'react';
import DateFilter from './DateFilter';
import LocationFilter from './LocationFilter';
import VehicleFilter from './VehicleFilter';
import ForvaltningFilter from './ForvaltningFilter';
import DepartmentFilter from './DepartmentFilter';
import ShiftFilter from './ShiftFilter';
import { Button } from '@mui/material';
import isoWeek from 'dayjs/plugin/isoWeek';
import { shift } from '@/components/hooks/useGetSettings';
import { Vehicle } from "@/components/hooks/useGetVehicles";
import {Mappings} from "@/app/(logged-in)/dashboard/(filters)/FilterWrapper";

dayjs.extend(isoWeek);

export type filterProps = {
    availableshifts?: (shift & { id: number })[];
    start?: string;
    end?: string;
    locations?: number[];
    forvaltninger?: string[];
    departments?: string[];
    vehicles?: number[];
    shifts?: number[];
    selectedShiftIndices?: number[];
};

export type Filters = {
    startdate?: string;
    enddate?: string;
    locations?: string | string[];
    forvaltninger?: string | string[];
    departments?: string | string[];
    vehicles?: string | string[];
    shifts?: string | string[];
    selectedShiftIndices?: number[];
};

export type FilterHeaderProps = {
    vehicleFilter?: boolean;
    locationFilter?: boolean;
    departmentFilter?: boolean;
    shiftFilter?: boolean;
    forvaltningFilter?: boolean;
    availableshifts?: (shift & { id: number })[];
    dbLocations?: locationInput[];
    dbVehicles?: Vehicle[];
    dbDepartments?: string[];
    dbForvaltninger?: string[];
    unknownDepartmentName?: string;
    unknownForvaltningName?: string;
    mappings?: Mappings
};

export type locationInput = {
    key: number;
    value: string;
}

export function getUniqueValues<T extends keyof Vehicle>(
  vehicles: Vehicle[] | undefined,
  property: T,
  defaultValue: string = ""
): string[] {
  const uniqueValues = vehicles?.reduce<Set<string>>((acc, vehicle) => {
    const value = vehicle[property] ? vehicle[property] as string : defaultValue;
    acc.add(value);
    return acc;
  }, new Set<string>());

  return Array.from(uniqueValues ?? []);
}


export default function FilterHeader({
    vehicleFilter = true,
    departmentFilter = true,
    locationFilter = true,
    shiftFilter = true,
    forvaltningFilter = true,
    availableshifts,
    dbLocations,
    dbVehicles,
    dbDepartments,
    dbForvaltninger,
    unknownDepartmentName,
    unknownForvaltningName,
    mappings
}: FilterHeaderProps) {


    const searchParams = useSearchParams();
    const router = useRouter();
    const path = usePathname();

    const [startDate, setStartDate] = useState<Dayjs>(
        searchParams.get('startdate') ? dayjs(searchParams.get('startdate')) : dayjs().add(-7, 'day').startOf('day')
    );
    const [endDate, setEndDate] = useState<Dayjs>(searchParams.get('enddate') ? dayjs(searchParams.get('enddate')) : dayjs());
    const [locations, setLocations] = useState<number[]>(searchParams.get('locations') ? searchParams.getAll('locations').map((loc) => +loc) : []);
    const [selectableLocations, setSelectableLocations] = useState<locationInput[] | undefined>(dbLocations);
    const [vehicles, setVehicles] = useState<number[]>(searchParams.get('vehicles') ? searchParams.getAll('vehicles').map((vehicle) => +vehicle) : []);
    const [selectableVehicles, setSelectableVehicles] = useState<Vehicle[] | undefined>(dbVehicles);
    const [departments, setDepartments] = useState<string[]>(searchParams.get('departments') ? searchParams.getAll('departments') : []);
    const [selectableDepartments, setSelectableDepartments] = useState<string[] | undefined>(dbDepartments);
    const [shifts, setShifts] = useState<number[]>(searchParams.get('shifts') ? searchParams.getAll('shifts').map((shift) => +shift) : []);
    const [forvaltninger, setForvaltninger] = useState<string[]>(searchParams.get('forvaltninger') ? searchParams.getAll('forvaltninger') : []);
    const [selectableForvaltninger, setSelectableForvaltninger] = useState<string[] | undefined>(dbForvaltninger);

    if (!unknownDepartmentName){
        unknownDepartmentName = "Ingen Afdeling"
    }
    if (!unknownForvaltningName){
        unknownForvaltningName = "Ingen Forvaltning"
    }

    useEffect(() => {
        const { newSelectableVehicles, newSelectableLocations, newSelectableDepartments, newSelectableForvaltninger } = recalculateFiltersWithMappings(
            searchParams.get('locations') ? searchParams.getAll('locations').map((loc) => +loc) : [],
            searchParams.get('departments') ? searchParams.getAll('departments') : [],
            searchParams.get('forvaltninger') ? searchParams.getAll('forvaltninger') : [],
            mappings,
            dbVehicles && searchParams.get('vehicles') ? dbVehicles.filter((veh) => searchParams.getAll('vehicles').map((vehicle) => +vehicle).includes(veh.id)) : dbVehicles,
          );
        setSelectableLocations(dbLocations?.filter((loc) => newSelectableLocations.includes(loc.key)));
        setSelectableVehicles(newSelectableVehicles);
        setSelectableDepartments(newSelectableDepartments);
        setSelectableForvaltninger(newSelectableForvaltninger);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbLocations, dbVehicles, dbDepartments, dbForvaltninger]);

    const recalculateFiltersWithMappings = (
      selectedLocations: number[],
      selectedDepartments: string[],
      selectedForvaltninger: string[],
      mappings?: Mappings,
      dbVehicles?: Vehicle[]
    ) => {
      const newSelectableVehicles = dbVehicles?.filter(vehicle =>
        (selectedLocations.length === 0 || selectedLocations.includes(vehicle.location?.id ?? -1)) &&
        (selectedDepartments.length === 0 || selectedDepartments.includes((vehicle.department ?? unknownDepartmentName) as string)) &&
        (selectedForvaltninger.length === 0 || selectedForvaltninger.includes((vehicle.forvaltning ?? unknownForvaltningName) as string))
      );

      const newSelectableLocations = selectedForvaltninger.length > 0
        ? selectedForvaltninger.flatMap(f => mappings?.forvaltningToLocation[f] || [])
        : selectedDepartments.length > 0
        ? selectedDepartments.flatMap(d => mappings?.departmentToLocation[d] || [])
        : dbVehicles?.map(v => v.location?.id).filter((loc): loc is number => loc !== undefined);

      const newSelectableDepartments = selectedLocations.length > 0
        ? selectedLocations.flatMap(loc => mappings?.locationToDepartment[loc] || [])
        : selectedForvaltninger.length > 0
        ? selectedForvaltninger.flatMap(f => mappings?.forvaltningToDepartment[f] || [])
        : dbVehicles?.map(v => v.department ?? unknownDepartmentName).filter((dep): dep is string => dep !== undefined);

      const newSelectableForvaltninger = selectedLocations.length > 0
        ? selectedLocations.flatMap(loc => mappings?.locationToForvaltning[loc] || [])
        : selectedDepartments.length > 0
        ? selectedDepartments.flatMap(d => mappings?.departmentToForvaltning[d] || [])
        : dbVehicles?.map(v => v.forvaltning ?? unknownForvaltningName).filter((forv): forv is string => forv !== undefined);

      return {
        newSelectableVehicles,
        newSelectableLocations: Array.from(new Set(newSelectableLocations)),
        newSelectableDepartments: Array.from(new Set(newSelectableDepartments)),
        newSelectableForvaltninger: Array.from(new Set(newSelectableForvaltninger)),
      };
    };

    const checkedLocation = (newSelectedLocations: locationInput[]) => {
      const newSelectedLocationsIds = newSelectedLocations.map(location => location.key);
      setLocations(newSelectedLocationsIds);

      const { newSelectableVehicles, newSelectableDepartments, newSelectableForvaltninger } = recalculateFiltersWithMappings(
        newSelectedLocationsIds,
        departments,
        forvaltninger,
        mappings,
        dbVehicles
      );

      setSelectableVehicles(newSelectableVehicles);
      setSelectableDepartments(newSelectableDepartments);
      setSelectableForvaltninger(newSelectableForvaltninger);
    };

    const checkedVehicle = (newSelectedVehicles: Vehicle[]) => {
        // we don't filter the other filters based on checked vehicle
        const newSelectedVehiclesIds = newSelectedVehicles.map((vehicle) => vehicle.id)
        setVehicles(newSelectedVehiclesIds)
    };
    const checkedDepartment = (newSelectedDepartments: string[]) => {
        setDepartments(newSelectedDepartments);

          const { newSelectableVehicles, newSelectableLocations, newSelectableForvaltninger } = recalculateFiltersWithMappings(
            locations,
            newSelectedDepartments,
            forvaltninger,
            mappings,
            dbVehicles
          );

        setSelectableVehicles(newSelectableVehicles);
        setSelectableLocations(dbLocations?.filter((loc) => newSelectableLocations.includes(loc.key)));
        setSelectableForvaltninger(newSelectableForvaltninger);
    };

    const checkedForvaltning = (newSelectedForvaltninger: string[]) => {
        setForvaltninger(newSelectedForvaltninger);

          const { newSelectableVehicles, newSelectableLocations, newSelectableDepartments } = recalculateFiltersWithMappings(
            locations,
            departments,
            newSelectedForvaltninger,
            mappings,
            dbVehicles
          );

        setSelectableVehicles(newSelectableVehicles);
        setSelectableLocations(dbLocations?.filter((loc) => newSelectableLocations.includes(loc.key)));
        setSelectableDepartments(newSelectableDepartments);
    };


    const setFilters = () => {
        const newParams = new URLSearchParams();
        newParams.append('startdate', startDate.format('YYYY-MM-DD'));
        newParams.append('enddate', endDate.format('YYYY-MM-DD'));
        if (locations.length > 0) {
            for (const location of locations) {
                newParams.append('locations', location.toString());
            }
        }
        if (vehicles.length > 0) {
            for (const vehicle of vehicles) {
                newParams.append('vehicles', vehicle.toString());
            }
        }
        if (departments.length > 0) {
            for (const department of departments) {
                newParams.append('departments', department);
            }
        }
        if (shifts.length > 0) {
            for (const shift of shifts) {
                newParams.append('shifts', shift.toString());
            }
        }
        if (forvaltninger.length > 0) {
            for (const forvaltning of forvaltninger) {
                newParams.append('forvaltninger', forvaltning);
            }
        }
        router.replace(path + '?' + newParams.toString());
    };

    const clearFilters = () => {
        setStartDate(dayjs().add(-7, 'day'));
        setEndDate(dayjs());
        setLocations([]);
        setVehicles([]);
        setDepartments([]);
        setShifts([]);
        setForvaltninger([]);
        router.replace(path);
        setSelectableLocations(dbLocations);
        setSelectableVehicles(dbVehicles);
        setSelectableDepartments(dbDepartments);
        setSelectableForvaltninger(dbForvaltninger);
    };

    return (
        <div className="sticky bg-white top-1 z-10 mb-2 p-2 flex drop-shadow-md flex-wrap">
            <DateFilter start={startDate} end={endDate} setEnd={setEndDate} setStart={setStartDate}></DateFilter>
            {locationFilter && (
                <LocationFilter
                    setSelectedLocations={checkedLocation}
                    selectableLocations={selectableLocations}
                    selectedLocations={locations}
                ></LocationFilter>
            )}
            {vehicleFilter &&
                <VehicleFilter
                    setSelectedVehicles={checkedVehicle}
                    selectedVehicles={vehicles}
                    selectableVehicles={selectableVehicles}
                ></VehicleFilter>}
            {forvaltningFilter && (
                <ForvaltningFilter
                    setSelectedForvaltninger={checkedForvaltning}
                    selectedForvaltninger={forvaltninger}
                    selectableForvaltninger={selectableForvaltninger}
                ></ForvaltningFilter>
            )}
            {departmentFilter && (
                <DepartmentFilter
                    setSelectedDepartments={checkedDepartment}
                    selectedDepartments={departments}
                    selectableDepartments={selectableDepartments}/>
            )}
            {shiftFilter && <ShiftFilter selectedShifts={shifts} setSelectedShifts={setShifts} availableShifts={availableshifts}></ShiftFilter>}
            <Button variant="contained" onClick={setFilters}>
                Anvend filtre
            </Button>
            <Button onClick={clearFilters}>Ryd filtrer</Button>
        </div>
    );
}
