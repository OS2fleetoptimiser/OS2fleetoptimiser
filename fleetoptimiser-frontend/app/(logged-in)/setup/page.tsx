'use client';

import { DateRangePicker, DateRangeType } from './DateRangePicker';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { fetchVehiclesByLocation, useGetForvaltninger, useGetLocations } from '@/components/hooks/useGetVehiclesByLocation';
import LocationPicker, { SelectedLocation } from './LocationPicker';
import { CircularProgress } from '@mui/material';
import { fetchSimulationSettings, setCars, setEndDate, setLocationForvaltning, setStartDate } from '@/components/redux/SimulationSlice';
import { useQueries } from '@tanstack/react-query';
import VehiclePicker from './VehiclePicker';
import { exportDrivingData } from '../setup/DrivingDataDownload';
import NoConnectionError from '@/app/(logged-in)/setup/NoConnectionError';
import NoSelectableVehicles from '@/app/(logged-in)/setup/NoSelectableVehicles';

export default function Home() {
    const dispatch = useAppDispatch();
    const simulationDisabled = useAppSelector((state) => state.simulation.selectedVehicles.every((car) => !['ok', 'locationChanged'].includes(car.status)));
    useEffect(() => {
        dispatch(fetchSimulationSettings());
    }, [dispatch]);

    // date stuff
    const { start_date, end_date, locationForvaltning, selectedVehicles } = useAppSelector((state) => state.simulation);
    const startPeriod = useMemo(() => dayjs(start_date), [start_date]);
    const endPeriod = useMemo(() => dayjs(end_date), [end_date]);
    const range = useMemo(() => [{ startDate: startPeriod, endDate: endPeriod, key: 'selection' }], [startPeriod, endPeriod]);
    const handleDateChange = (dates: DateRangeType) => {
        if (dates.startDate && dates.endDate) {
            dispatch(setStartDate(dates.startDate.format('YYYY-MM-DD')));
            dispatch(setEndDate(dates.endDate.format('YYYY-MM-DD')));
        }
    };

    // location stuff
    const { data: onlyLocs, isPending: locationsLoading } = useGetLocations();
    const { data: forvaltninger, isPending: forvaltningerLoading } = useGetForvaltninger();

    const handleLocationChange = (selectedLocations: SelectedLocation[]) => {
        dispatch(setLocationForvaltning(selectedLocations));

        const validVehicles = selectedVehicles.filter((vehicle) =>
            selectedLocations.some((loc) => loc.id === vehicle.location?.id && loc.forvaltning === vehicle.forvaltning)
        );

        dispatch(setCars(validVehicles));
        setSelectedVehicleIds(validVehicles.map((v) => v.id));
    };

    // vehicle stuff
    const vehicles = useQueries({
        queries: locationForvaltning.map((location) => ({
            queryKey: ['vehiclesByLocation', startPeriod, endPeriod, location.id, location.forvaltning],
            queryFn: () => {
                return fetchVehiclesByLocation({startPeriod, endPeriod, location: location.id, forvaltning: location.forvaltning})
            },
            staleTime: Infinity,
        })),
    });
    const allVehicles = vehicles.flatMap((q) => q.data?.locations ?? []).flatMap((loc) => loc.vehicles ?? []);
    const [selectedVehicleIds, setSelectedVehicleIds] = useState(selectedVehicles.map((v) => v.id));
    const handleVehicleChange = (selectedVehicleIds: number[]) => {
        const vehicleWithStatusSelected = allVehicles.filter((v) => selectedVehicleIds.includes(v.id));
        setSelectedVehicleIds(vehicleWithStatusSelected.map((v) => v.id));
        dispatch(setCars(vehicleWithStatusSelected));
    };

    const handleDownload = () => {
        exportDrivingData(
            startPeriod.format('YYYY-MM-DD'),
            endPeriod.format('YYYY-MM-DD'),
            locationForvaltning.map((loc) => loc.id)
        );
    };

    const isLoadingVehicles = vehicles.some((q) => q.isPending);
    return (
        <div className="space-y-6 max-w-[1800px] mx-auto">
            <DateRangePicker range={range} onChange={handleDateChange} />
            {(forvaltningerLoading || locationsLoading) && <CircularProgress />}
            {onlyLocs && !forvaltningerLoading && (
                <LocationPicker
                    forvaltninger={forvaltninger}
                    locations={onlyLocs.locations}
                    preSelectedLocations={locationForvaltning}
                    onSelectionChange={handleLocationChange}
                />
            )}
            {/*todo replace with component from landing page no connection*/}
            {/*no onlyLocs implies no connection */}
            {!locationsLoading && !onlyLocs && <NoConnectionError />}
            {!isLoadingVehicles && allVehicles.length === 0 && locationForvaltning.length > 0 && <NoSelectableVehicles />}
            {vehicles.some((q) => q.isError) && <NoConnectionError />}
            {allVehicles.length > 0 && (
                <VehiclePicker
                    vehicles={allVehicles}
                    selectedVehicleIds={selectedVehicleIds}
                    onSelectionChange={handleVehicleChange}
                    isLoading={isLoadingVehicles}
                    simulationDisabled={simulationDisabled}
                    onDownload={handleDownload}
                />
            )}
        </div>
    );
}
