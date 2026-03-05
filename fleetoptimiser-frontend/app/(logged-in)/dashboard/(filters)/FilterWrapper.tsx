'use client';

import {FilterHeaderProps} from "@/app/(logged-in)/dashboard/(filters)/FilterHeader";
import FilterHeader, {getUniqueValues} from "@/app/(logged-in)/dashboard/(filters)/FilterHeader";
import useGetVehicles from "@/components/hooks/useGetVehicles";
import useGetDropDownData from "@/components/hooks/useGetDropDownData";
import {CircularProgress} from "@mui/material";
import { Vehicle } from "@/components/hooks/useGetVehicles";


export const FilterHeaderWrapper = (props: FilterHeaderProps) => {
    const unknownDepartmentName = "Ingen Afdeling"
    const unknownForvaltningName = "Ingen Forvaltning"

    // static data to use for reference across filters
    const vehiclesDB = useGetVehicles((data) => {

        return data.vehicles.filter((vehicle) => vehicle.plate && vehicle.make && vehicle.location && vehicle.location.id && (vehicle.disabled === null || !vehicle.disabled))
    })
    const locationsDB = useGetDropDownData((data) =>
        data.locations.map((loc) => ({
            key: loc.id,
            value: loc.address,
        }))
    );
  return (
      <>
          {
              locationsDB.data && vehiclesDB.data &&
                  <FilterHeader
                      {...props}
                      dbLocations={locationsDB.data}
                      dbDepartments={getUniqueValues(vehiclesDB.data, 'department', unknownDepartmentName)}
                      dbVehicles={vehiclesDB.data}
                      dbForvaltninger={getUniqueValues(vehiclesDB.data, 'forvaltning', unknownForvaltningName)}
                      unknownDepartmentName={unknownDepartmentName}
                      unknownForvaltningName={unknownForvaltningName}
                      mappings={generateMappings(vehiclesDB.data)}
                  />
          }
          {
              (!locationsDB.data || !vehiclesDB.data) &&
              <CircularProgress/>
          }
    </>
  );
};


export type Mappings = {
  locationToForvaltning: Record<number, string[]>;
  locationToDepartment: Record<number, string[]>;
  forvaltningToLocation: Record<string, number[]>;
  departmentToForvaltning: Record<string, string[]>;
  departmentToLocation: Record<string, number[]>;
  forvaltningToDepartment: Record<string, string[]>;
};

function generateMappings(vehicles: Vehicle[]): Mappings {
  const locationToForvaltning: Record<number, string[]> = {};
  const locationToDepartment: Record<number, string[]> = {};
  const forvaltningToLocation: Record<string, number[]> = {};
  const departmentToForvaltning: Record<string, string[]> = {};
  const departmentToLocation: Record<string, number[]> = {};
  const forvaltningToDepartment: Record<string, string[]> = {};

  vehicles.forEach((vehicle) => {

   if (!vehicle.location || !vehicle.location.id) {
      return;
   }

    const locationId = vehicle.location.id;
    const forvaltning = vehicle.forvaltning || "Ingen Forvaltning";
    const department = vehicle.department || "Ingen Afdeling";

    // Location to Forvaltning mapping
    if (!locationToForvaltning[locationId]) {
      locationToForvaltning[locationId] = [];
    }
    if (!locationToForvaltning[locationId].includes(forvaltning)) {
      locationToForvaltning[locationId].push(forvaltning);
    }

    // Location to Department mapping
    if (!locationToDepartment[locationId]) {
      locationToDepartment[locationId] = [];
    }
    if (!locationToDepartment[locationId].includes(department)) {
      locationToDepartment[locationId].push(department);
    }

    // Forvaltning to Location mapping
    if (!forvaltningToLocation[forvaltning]) {
      forvaltningToLocation[forvaltning] = [];
    }
    if (!forvaltningToLocation[forvaltning].includes(locationId)) {
      forvaltningToLocation[forvaltning].push(locationId);
    }

    // Department to Forvaltning mapping
    if (!departmentToForvaltning[department]) {
      departmentToForvaltning[department] = [];
    }
    if (!departmentToForvaltning[department].includes(forvaltning)) {
      departmentToForvaltning[department].push(forvaltning);
    }

    // Department to Location mapping
    if (!departmentToLocation[department]) {
      departmentToLocation[department] = [];
    }
    if (!departmentToLocation[department].includes(locationId)) {
      departmentToLocation[department].push(locationId);
    }

    // Forvaltning to Department mapping
    if (!forvaltningToDepartment[forvaltning]) {
      forvaltningToDepartment[forvaltning] = [];
    }
    if (!forvaltningToDepartment[forvaltning].includes(department)) {
      forvaltningToDepartment[forvaltning].push(department);
    }
  });

  return {
    locationToForvaltning,
    locationToDepartment,
    forvaltningToLocation,
    departmentToForvaltning,
    departmentToLocation,
    forvaltningToDepartment,
  };
}
