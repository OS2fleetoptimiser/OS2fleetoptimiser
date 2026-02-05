'use client';
import FleetSimulationHandler from '@/app/(logged-in)/fleet/FleetSimulationHandler';
import { use, useEffect, useState } from 'react';
import useGetFleetSimulation from '@/components/hooks/useGetFleetSimulation';
import useGetVehiclesByLocation from '@/components/hooks/useGetVehiclesByLocation';
import dayjs from 'dayjs';
import useGetVehicles from '@/components/hooks/useGetVehicles';
import { useAppDispatch } from '@/components/redux/hooks';
import {
    addExtraVehicles,
    fetchSimulationSettings,
    setAllSettings,
    setCars,
    setEndDate,
    setIntelligentAllocation,
    setLimitKm,
    setLocationAddresses,
    setLocationId,
    setLocationIds,
    setSimulationVehicles,
    setStartDate,
} from '@/components/redux/SimulationSlice';
import { CircularProgress } from '@mui/material';

export default function Page({ params }: { params: Promise<{ simulationId: string }> }) {
    const { simulationId } = use(params);
    const simulation = useGetFleetSimulation(simulationId);

    const vehiclesByLocation = useGetVehiclesByLocation({
        startPeriod: dayjs(simulation.data?.result.simulation_options.start_date),
        endPeriod: dayjs(simulation.data?.result.simulation_options.end_date),
        locations: simulation.data?.result.simulation_options.location_ids,
        enabled: !!simulation.data,
        selector: (data) => {
            if (simulation.data!.result.simulation_options.location_ids) {
                return data.locations.filter((loc) => simulation.data!.result.simulation_options.location_ids!.includes(loc.id)).flatMap((loc) => loc);
            } else {
                const loc = data.locations.find((loc) => loc.id === simulation.data?.result.simulation_options.location_id);
                return loc ? [loc] : undefined;
            }
        },
    });

    const allVehicles = useGetVehicles();

    const dispatch = useAppDispatch();

    useEffect(() => {
        if (simulation.data && vehiclesByLocation.data && allVehicles.data) {
            const simulationOptions = simulation.data.result.simulation_options;
            const selectedVehicles = vehiclesByLocation.data
                .map((locationVehicles) => locationVehicles.vehicles.filter((vehicle) => simulationOptions.current_vehicles.includes(vehicle.id)))
                .flatMap((vehicle) => vehicle);

            dispatch(fetchSimulationSettings());
            dispatch(setLocationAddresses(vehiclesByLocation.data.map((location) => ({ address: location.address, id: location.id }))));
            dispatch(setAllSettings(simulationOptions.settings));
            dispatch(setStartDate(simulationOptions.start_date));
            dispatch(setEndDate(simulationOptions.end_date));
            dispatch(setLocationId(simulationOptions.location_id));
            dispatch(setLocationIds(simulationOptions.location_ids ?? []));
            dispatch(setIntelligentAllocation(simulationOptions.intelligent_allocation));
            dispatch(setLimitKm(simulationOptions.limit_km));
            dispatch(setCars(selectedVehicles));
            dispatch(setSimulationVehicles(simulationOptions.simulation_vehicles));
            const extraVehicles = simulationOptions.simulation_vehicles.filter((vehicleId) => !selectedVehicles.find((vehicle) => vehicle.id === vehicleId.id));
            dispatch(addExtraVehicles(allVehicles.data.vehicles.filter((vehicle) => extraVehicles.find((extra) => extra.id === vehicle.id))));
        }
    }, [simulation, vehiclesByLocation, allVehicles]);
    return (
        <>
            {!vehiclesByLocation.isPending && <FleetSimulationHandler simulationId={simulationId} />}
            {vehiclesByLocation.isPending && (
                <div className="w-full h-full z-10 top-0 left-0 fixed bg-[#FFFFFF75]">
                    <div className="top-[40%] left-[50%] absolute transform -translate-x-1/2 -translate-y-1/2">
                        <CircularProgress />
                    </div>
                </div>
            )}
        </>
    );
}
