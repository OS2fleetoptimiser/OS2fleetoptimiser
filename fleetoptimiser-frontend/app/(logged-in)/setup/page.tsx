'use client';

import CarTable from '@/app/(logged-in)/setup/CarTable';
import ApiError from '@/components/ApiError';
import { VehicleWithStatus, fetchVehiclesByLocation, useGetForvaltninger, useGetLocations } from '@/components/hooks/useGetVehiclesByLocation';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { useRouter } from 'next/navigation';
import {
    clearCars,
    fetchSimulationSettings,
    removeCarById,
    setCars,
    setEndDate,
    setForvaltningLocations,
    setLocationId,
    setLocationIds,
    setStartDate,
} from '@/components/redux/SimulationSlice';
import ToolTip from '@/components/ToolTip';
import { Search } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import MemoryIcon from '@mui/icons-material/Memory';
import KeyboardDoubleArrowUpTwoToneIcon from '@mui/icons-material/KeyboardDoubleArrowUpTwoTone';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    ButtonGroup,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    FormGroup,
    IconButton,
    InputAdornment,
    TextField,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/da';
import { Inter } from 'next/font/google';
import { useEffect, useState, useMemo } from 'react';
import { AiOutlineArrowRight } from 'react-icons/ai';
import { exportDrivingData } from './DrivingDataDownload';

const inter = Inter({ subsets: ['latin'] });

const carSorting = (car1: VehicleWithStatus, car2: VehicleWithStatus): number => {
    if (car1.status === car2.status) {
        return (car1.plate ?? '') + (car1.make ?? '') + (car1.model ?? '') > (car2.plate ?? '') + (car2.make ?? '') + (car2.model ?? '') ? 1 : -1;
    } else {
        if (car1.status === 'ok') return 1;
        if (car1.status === 'dataMissing')
            switch (car2.status) {
                case 'ok':
                    return -1;
                default:
                    1;
            }
        if (car1.status === 'locationChanged') {
            switch (car2.status) {
                case 'ok':
                    return -1;
                case 'dataMissing':
                    return -1;
                default:
                    1;
            }
        }
        if (car1.status === 'leasingEnded') {
            switch (car2.status) {
                case 'ok':
                    return -1;
                case 'dataMissing':
                    return -1;
                case 'locationChanged':
                    return -1;
                default:
                    1;
            }
        }
        if (car1.status === 'notActive') {
            return -1;
        }
    }
    return 0;
};

export default function Home() {
    const startDateString = useAppSelector((state) => state.simulation.start_date);
    const endDateString = useAppSelector((state) => state.simulation.end_date);
    const startPeriod = useMemo(() => dayjs(startDateString), [startDateString]);
    const endPeriod = useMemo(() => dayjs(endDateString).add(1, 'day'), [endDateString]);
    const locationId = useAppSelector((state) => state.simulation.location_id);
    const locationIds = useAppSelector((state) => state.simulation.location_ids);
    const [selectedLocations, setSelectedLocations] = useState<number[]>(useAppSelector((state) => state.simulation.location_ids));
    const [selectedForvaltninger, setSelectedForvaltninger] = useState<Record<string, any>>(useAppSelector((state) => state.simulation.forvaltninger));
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartments, setSelectedDepartments] = useState<any>([]);
    const [savedLocationVehicles, setSavedLocationVehicles] = useState<any>({});

    const router = useRouter();

    // User must choose cars that have been driven in the given period to continue
    const disableSimulationLink = useAppSelector(
        (state) =>
            state.simulation.selectedVehicles.filter((car) => car.status === 'ok' || car.status === 'locationChanged' || car.status === 'leasingEnded')
                .length === 0
    );

    const disableGoalLink = useAppSelector((state) => {
        const filteredVehicles = state.simulation.selectedVehicles.filter(
            (car) => car.status === 'ok' || car.status === 'locationChanged' || car.status === 'leasingEnded'
        );
        return filteredVehicles.length === 0 || filteredVehicles.length > 100;
    });

    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(fetchSimulationSettings());
    }, [dispatch]);

    const locations = useQueries({
        queries: selectedLocations.map((locId) => ({
            queryKey: ['vehiclesByLocation', startPeriod, endPeriod, locId],
            queryFn: () =>
                fetchVehiclesByLocation({
                    startPeriod,
                    endPeriod,
                    location: locId,
                }),
            enabled: true,
            refetchOnWindowFocus: false,
            staleTime: Infinity,
        })),
    });
    // todo release selected locations when deselecting forvaltning
    useEffect(() => {
        const allFetched = locations.every((query) => query.isSuccess || query.isError);
        if (allFetched) {
            let locData = locations.map((los) => los.data.locations).flatMap((loc) => loc);
            const updatedState = { ...savedLocationVehicles };

            let isChanged = false;
            // check if forvaltninger is used
            let useLocations = forvaltninger.data === null || false;
            let visited: number[] = [];

            for (const [key, value] of Object.entries(locData)) {
                // iterating over the locations
                if (useLocations) {
                    if (!savedLocationVehicles[value.id] || JSON.stringify(savedLocationVehicles[value.id]) !== JSON.stringify(value.vehicles)) {
                        updatedState[value.id] = value.vehicles;
                        isChanged = true;
                    }
                } else {
                    let vehiclesToUse = [];
                    if (visited.includes(value.id)) {
                        continue;
                    }
                    visited.push(value.id);
                    for (const vehicle of value.vehicles) {
                        // iterating over the vehicles of the location
                        let currentForvaltning = vehicle.forvaltning === null ? 'Ingen Forvaltning' : vehicle.forvaltning;
                        // only add those vehicles that is not already part of the value id
                        if (currentForvaltning in selectedForvaltninger) {
                            if (selectedForvaltninger[currentForvaltning].includes(vehicle.location.id)) {
                                vehiclesToUse.push(vehicle);
                            }
                        }
                    }
                    if (!savedLocationVehicles[value.id] || JSON.stringify(savedLocationVehicles[value.id]) !== JSON.stringify(vehiclesToUse)) {
                        updatedState[value.id] = vehiclesToUse;
                        isChanged = true;
                    }
                }
            }

            if (isChanged) {
                setSavedLocationVehicles(updatedState);
            }
        }
    }, [locations]);

    const accordionProps = {
        sx: {
            pointerEvents: 'none',
        },
        expandIcon: (
            <KeyboardDoubleArrowUpTwoToneIcon
                sx={{
                    pointerEvents: 'auto',
                }}
            />
        ),
    };

    const onlyLocs = useGetLocations();
    const forvaltninger = useGetForvaltninger();
    return (
        <div>
            <div className="lg:flex lg:flex-nowrap lg:justify-between eighty">
                <div className="w-full h-full lg:w-2/5 lg:mx-2 flex flex-col">
                    <Typography variant="h2" className="mb-6">
                        Lokationer
                    </Typography>
                    <div className="bg-white p-2 drop-shadow-md mb-10 custom-nav">
                        <Typography variant="h4" className="mb-2">
                            Periode
                            <ToolTip>
                                Vælg en start- og slutdato som udgangspunkt for dine simuleringer. Turene der er kørt i perioden bliver brugt i simuleringerne
                            </ToolTip>
                        </Typography>

                        <div className="flex items-center justify-between mb-2">
                            <DatePicker // todo fix this
                                value={startPeriod}
                                onChange={(e) => {
                                    if (e && e.isValid()) {
                                        dispatch(setStartDate(e.format('YYYY-MM-DD')));
                                    }}}
                                label="Fra"
                                className="flex-1"
                            />
                            <AiOutlineArrowRight />
                            <DatePicker
                                value={endPeriod}
                                onChange={(e) => {
                                    if (e && e.isValid()) {
                                        dispatch(setEndDate(e.format('YYYY-MM-DD')));
                                    }
                                }}
                                label="Til"
                                className="flex-1"
                            />
                        </div>
                    </div>
                    <div className="flex-grow bg-white p-2 drop-shadow-md overflow-auto custom-nav">
                        <Typography variant="h4" className="mb-2">
                            {(forvaltninger.data === null || false) && <>Adresse</>}
                            {forvaltninger.data !== null && forvaltninger.data !== undefined && <>Forvaltninger</>}
                            <ToolTip>Vælg en lokation som udgangspunkt for dine simuleringer</ToolTip>
                            <FormControl>
                                <TextField
                                    fullWidth
                                    className="mb-2 ml-2"
                                    size="small"
                                    type="text"
                                    placeholder="Søg efter lokationer..."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <IconButton>
                                                    <Search />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </FormControl>
                        </Typography>
                        <div className="list-text">
                            {onlyLocs.isError && <ApiError retryFunction={onlyLocs.refetch}>Lokationer kunne ikke hentes</ApiError>}
                            {onlyLocs.isLoading && (
                                <div className="flex justify-center w-full p-4">
                                    <CircularProgress />
                                </div>
                            )}
                            {onlyLocs.data && (forvaltninger.data === null || false) && (
                                <FormGroup>
                                    {onlyLocs.data.locations
                                        ?.filter((loc) => loc.address.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .sort((a, b) => (a.address > b.address ? 1 : -1))
                                        .map((loc, i) => (
                                            <FormControlLabel
                                                key={loc.id}
                                                control={
                                                    <Checkbox
                                                        value={loc.id}
                                                        checked={selectedLocations.includes(loc.id)}
                                                        onChange={(e) => {
                                                            dispatch(setLocationId(loc.id));
                                                            let newSelectedLocations = [...selectedLocations];
                                                            if (e.target.checked) {
                                                                newSelectedLocations.push(loc.id);
                                                            } else {
                                                                newSelectedLocations = newSelectedLocations.filter((localiteten: any) => localiteten !== loc.id);
                                                                savedLocationVehicles[loc.id].forEach((car: VehicleWithStatus) => dispatch(removeCarById(car.id)));
                                                            }
                                                            dispatch(setLocationIds(newSelectedLocations));
                                                            setSelectedLocations(newSelectedLocations);
                                                        }}
                                                    />
                                                }
                                                label={loc.address}
                                                className="border-b mx-0"
                                            />
                                        ))}
                                </FormGroup>
                            )}
                            {forvaltninger.data !== null && forvaltninger.data !== undefined && onlyLocs.data && (
                                <FormGroup>
                                    {Object.entries(forvaltninger.data).map(([forvaltningName, forvaltningLocations]) => (
                                        <Accordion key={`accordion_${forvaltningName}`}>
                                            <AccordionSummary style={{ pointerEvents: 'none' }} {...accordionProps}>
                                                <FormControlLabel
                                                    style={{ pointerEvents: 'auto', zIndex: '9999' }}
                                                    control={
                                                        <Tooltip
                                                            title={
                                                                !(forvaltningName in selectedForvaltninger) || selectedForvaltninger[forvaltningName]?.length == 0
                                                                    ? 'Du kan ikke vælge alle lokationer på samme tid'
                                                                    : ''
                                                            }
                                                        >
                                                            <Checkbox
                                                                style={{ zIndex: '9999', pointerEvents: 'auto' }}
                                                                disabled={
                                                                    !(forvaltningName in selectedForvaltninger) ||
                                                                    selectedForvaltninger[forvaltningName]?.length == 0
                                                                }
                                                                value={forvaltningName}
                                                                checked={selectedForvaltninger[forvaltningName]?.length >= 1}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => {
                                                                    let newSelectedForvaltninger = { ...selectedForvaltninger };
                                                                    if (e.target.checked) {
                                                                        newSelectedForvaltninger[forvaltningName] = forvaltninger.data[forvaltningName];
                                                                        let newSelectedLocations = [...selectedLocations];
                                                                        newSelectedLocations.push(...forvaltninger.data[forvaltningName]);
                                                                        newSelectedLocations = Array.from(new Set(newSelectedLocations));
                                                                        // add all locations that is not already part of selected locations
                                                                        setSelectedLocations(newSelectedLocations);
                                                                        dispatch(setLocationIds(newSelectedLocations));
                                                                    } else {
                                                                        newSelectedForvaltninger[forvaltningName] = [];
                                                                        selectedForvaltninger[forvaltningName].forEach((locationId: number) =>
                                                                            savedLocationVehicles[locationId].forEach((car: VehicleWithStatus) =>
                                                                                dispatch(removeCarById(car.id))
                                                                            )
                                                                        );
                                                                    }
                                                                    setSelectedForvaltninger(newSelectedForvaltninger);
                                                                    dispatch(setForvaltningLocations(newSelectedForvaltninger));
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    }
                                                    label={<span style={{ color: 'rgba(0, 0, 0, 1)' }}>{forvaltningName}</span>}
                                                    className="font-semibold"
                                                />
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                {forvaltningLocations
                                                    .map((locId) => onlyLocs.data.locations.find((loc) => loc.id === locId))
                                                    .filter((loc) => loc && loc.address.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .sort((a, b) => (a && b ? a.address.localeCompare(b.address) : 0))
                                                    .map((loc) => (
                                                        <FormControlLabel
                                                            key={loc?.id}
                                                            control={
                                                                <Checkbox
                                                                    value={`${forvaltningName}_${loc?.id}`}
                                                                    checked={selectedForvaltninger[forvaltningName]?.includes(loc?.id) ?? false}
                                                                    onChange={(e) => {
                                                                        const locationId = loc?.id;
                                                                        const isChecked = e.target.checked;

                                                                        const updatedForvaltninger = { ...selectedForvaltninger };
                                                                        if (isChecked) {
                                                                            const newList = updatedForvaltninger[forvaltningName]
                                                                                ? [...updatedForvaltninger[forvaltningName], locationId]
                                                                                : [locationId];
                                                                            updatedForvaltninger[forvaltningName] = newList;
                                                                            if (!updatedForvaltninger[forvaltningName]) {
                                                                                updatedForvaltninger[forvaltningName] = [];
                                                                            }
                                                                            if (!updatedForvaltninger[forvaltningName].includes(locationId)) {
                                                                                updatedForvaltninger[forvaltningName].push(locationId);
                                                                            }
                                                                        } else {
                                                                            updatedForvaltninger[forvaltningName] = updatedForvaltninger[forvaltningName].filter(
                                                                                (id: number) => id !== locationId
                                                                            );
                                                                        }
                                                                        setSelectedForvaltninger(updatedForvaltninger);

                                                                        let updatedLocations = [...selectedLocations];
                                                                        if (isChecked && !updatedLocations.includes(locationId ? locationId : 0)) {
                                                                            updatedLocations.push(locationId ? locationId : 0);
                                                                        } else if (!isChecked && locationId) {
                                                                            savedLocationVehicles[locationId].forEach((car: VehicleWithStatus) =>
                                                                                dispatch(removeCarById(car.id))
                                                                            );
                                                                            const isLocationStillSelected = Object.values(updatedForvaltninger).some((locArray) =>
                                                                                locArray.includes(locationId)
                                                                            );
                                                                            if (!isLocationStillSelected) {
                                                                                updatedLocations = updatedLocations.filter((id) => id !== locationId);
                                                                            }
                                                                        }
                                                                        setSelectedLocations(updatedLocations);
                                                                        dispatch(setLocationIds(updatedLocations));
                                                                        dispatch(setForvaltningLocations(updatedForvaltninger));
                                                                    }}
                                                                />
                                                            }
                                                            label={loc?.address}
                                                            className="border-b mx-0 my-2 flex"
                                                        />
                                                    ))}
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </FormGroup>
                            )}
                        </div>
                    </div>
                </div>
                <div className="w-full h-full lg:ml-10 flex flex-col">
                    <div className="lg:flex justify-between mb-2">
                        <Typography variant="h2" className="mb-2">
                            Køretøjer
                        </Typography>
                        <Button
                            color="primary"
                            startIcon={<DownloadIcon />}
                            onClick={() => exportDrivingData(startPeriod.format('YYYY-MM-DD'), endPeriod.format('YYYY-MM-DD'), selectedLocations)}
                            variant="contained"
                            className="mb-2"
                        >
                            Download dataperiode
                        </Button>
                    </div>
                    <div className="flex-grow bg-white p-2 drop-shadow-md overflow-auto custom-nav">
                        {selectedLocations.length > 1 &&
                            'Vær opmærksom på at simulering på flere lokationer, betyder at køretøjerne deles mellem de valgte lokationer.'}
                        {
                            <CarTable
                                cars={
                                    selectedLocations.flatMap((locId) => (savedLocationVehicles ? savedLocationVehicles[locId] || [] : [])).sort(carSorting) ?? []
                                }
                                selectedDepartments={selectedDepartments}
                                setSelectedDepartments={setSelectedDepartments}
                            />
                        }
                        {locations.some((locCall) => locCall.isLoading) && (!(locationId == 0 || locationId == undefined) || !(locationIds == undefined)) && (
                            <center>
                                <CircularProgress />
                            </center>
                        )}
                        {locations.some((locCall) => locCall.isLoading) && (locationId == 0 || locationId == undefined)}
                        {!locations.some((locCall) => locCall.isLoading) && locations.some((locCall) => locCall.isLoading) ? null : (
                            <div className="flex justify-end">
                                <ButtonGroup>
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            const vehicles = selectedLocations.flatMap((locId) =>
                                                savedLocationVehicles ? savedLocationVehicles[locId] || [] : []
                                            );
                                            if (vehicles) {
                                                dispatch(setCars(vehicles));
                                            }
                                        }}
                                    >
                                        Vælg alle
                                    </Button>
                                    <Button variant="outlined" onClick={() => dispatch(clearCars())}>
                                        Fravælg alle
                                    </Button>
                                </ButtonGroup>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex justify-end mt-8 gap-4">
                <Tooltip title={disableSimulationLink ? 'Manuel simulering er deaktiveret, hvis ingen køretøjer er valgt.' : ''}>
                    <span>
                        <Button
                            color="primary"
                            startIcon={<DirectionsCarIcon />}
                            onClick={() => router.push('/fleet')}
                            disabled={disableSimulationLink}
                            variant="contained"
                        >
                            Manuel simulering
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title={disableGoalLink ? 'Automatisk simulering er deaktiveret, hvis ingen eller over 100 køretøjer er valgt.' : ''}>
                    <span>
                        <Button
                            color="primary"
                            startIcon={<MemoryIcon />}
                            onClick={() => router.push('/goal')}
                            disabled={disableGoalLink}
                            variant="contained"
                        >
                            Automatisk simulering
                        </Button>
                    </span>
                </Tooltip>
            </div>
        </div>
    );
}
