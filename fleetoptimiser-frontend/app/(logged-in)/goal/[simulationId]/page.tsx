'use client';

import { useGetGoalSimulation } from '@/components/hooks/useGetGoalSimulation';
import useGetVehiclesByLocation from '@/components/hooks/useGetVehiclesByLocation';
import {
    addTestVehicles,
    setCars,
    setEndDate,
    setGoalSimulationVehicles,
    setIntelligentAllocation,
    setLimitKm,
    setLocationId,
    setLocationIds,
    setAllSettings,
    setStartDate,
    fetchSimulationSettings,
    addTestVehiclesMeta,
    setLocationAddresses,
} from '@/components/redux/SimulationSlice';
import { useAppDispatch } from '@/components/redux/hooks';
import dayjs from 'dayjs';
import { use, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import useGetVehicles from '@/components/hooks/useGetVehicles';
import GoalSimulationHandler from '@/app/(logged-in)/goal/GoalSimulationHandler';

export default function Page({ params }: { params: Promise<{ simulationId: string }> }) {
    const { simulationId } = use(params);
    const simulation = useGetGoalSimulation(simulationId);
    const vehicles = useGetVehiclesByLocation({
        startPeriod: dayjs(simulation.data?.result.simulation_options.start_date),
        endPeriod: dayjs(simulation.data?.result.simulation_options.end_date),
        locations: simulation.data?.result.simulation_options.location_ids,
        enabled: !!simulation.data,
        selector: (data) => {
            if (simulation.data?.result.simulation_options.location_ids) {
                return data.locations.filter((loc) => simulation.data?.result.simulation_options.location_ids?.includes(loc.id)).flatMap((loc) => loc);
            } else {
                const location = data.locations.find((loc) => loc.id === simulation.data?.result.simulation_options.location_id);
                return location ? [location] : undefined;
            }
        },
    });

    const dispatch = useAppDispatch();
    const allVehicles = useGetVehicles();
    useEffect(() => {
        if (simulation.data && vehicles.data) {
            const simulationOptions = simulation.data.result.simulation_options;

            const selectedVehicles = vehicles.data
                .map((locationVehicles) => locationVehicles.vehicles.filter((vehicle) => simulationOptions.current_vehicles.includes(vehicle.id)))
                .flatMap((vehicle) => vehicle);
            dispatch(fetchSimulationSettings());
            dispatch(setLocationAddresses(vehicles.data.map((location) => ({ address: location.address, id: location.id }))));
            dispatch(setAllSettings(simulationOptions.settings));
            dispatch(setStartDate(simulationOptions.start_date));
            dispatch(setEndDate(simulationOptions.end_date));
            dispatch(setLocationId(simulationOptions.location_id));
            dispatch(setLocationIds(simulationOptions.location_ids ?? []));
            dispatch(setIntelligentAllocation(simulationOptions.intelligent_allocation));
            dispatch(setLimitKm(simulationOptions.limit_km));
            dispatch(setCars(selectedVehicles));
            dispatch(setGoalSimulationVehicles(simulationOptions.fixed_vehicles));
            dispatch(addTestVehicles(simulationOptions.test_vehicles));
            dispatch(addTestVehiclesMeta(allVehicles.data?.vehicles.filter((vehicle) => simulationOptions.test_vehicles.includes(vehicle.id))));
        }
    }, [simulation, vehicles, allVehicles, dispatch]);

    return (
        <>
            {vehicles.isPending && (
                <div className="w-full h-full z-10 top-0 left-0 fixed bg-[#FFFFFF75]">
                    <div className="top-[40%] left-[50%] absolute transform -translate-x-1/2 -translate-y-1/2">
                        <CircularProgress />
                    </div>
                </div>
            )}
            {!vehicles.isPending && <GoalSimulationHandler simulationId={simulationId}></GoalSimulationHandler>}
        </>
    );
}
