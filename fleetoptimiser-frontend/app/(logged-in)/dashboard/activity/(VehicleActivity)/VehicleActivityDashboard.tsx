'use client';

import { useGetGroupedDrivingData } from '@/components/hooks/useGetDrivingData';
import { Button, Card, InputAdornment, Paper, Skeleton, Tab, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useState } from 'react';
import { HeatMapGroupWithMetaData, DrivingHeatmapKm } from './DrivingHeatmap';
import ApiError from '@/components/ApiError';
import { ComputedCell } from '@nivo/heatmap';
import TabList from '@mui/lab/TabList';
import { TabContext, TabPanel } from '@mui/lab';
import AxiosBase from '@/components/AxiosBase';
import DownloadingIcon from '@mui/icons-material/Downloading';
import { useRouter, useSearchParams } from 'next/navigation';
import { filterProps } from '../../(filters)/FilterHeader';
import { DownloadableGraph } from '@/components/DownloadableGraph';

dayjs.extend(isoWeek);

const VehicleActivityDashboard = ({
    availableshifts,
    end,
    start,
    departments,
    locations,
    forvaltninger,
    vehicles,
    shifts,
    selectedShiftIndices,
}: filterProps) => {
    const [colorThreshold, setColorThreshold] = useState<string>('40');
    const [tab, setTab] = useState<string>('locations');
    const router = useRouter();

    const { queryObject: heatMapData, queryString } = useGetGroupedDrivingData({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        vehicleIds: vehicles,
        departments: departments,
        forvaltninger: forvaltninger,
        shiftsAggregate: availableshifts,
        includeTripSegments: false,
        asTripSegments: true,
        selector: (data) => {
            return {
                locationGroup: {
                    km: data.location_grouped,
                },
                vehicleGroup: {
                    km: data.vehicle_grouped,
                },
                locations: data.query_locations,
                vehicles: data.query_vehicles,
            };
        },
        shiftFilter: shifts,
        selectedShifts: selectedShiftIndices,
    });

    const searchParams = useSearchParams();

    const goToLocation = (e: ComputedCell<HeatMapGroupWithMetaData>) => {
        if (tab === 'vehicles') {
            const vehicleId = heatMapData.data!.vehicles.find((vehicle) => vehicle.name === e.serieId)!.id;
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('vehicles');
            newSearchParams.append('vehicles', vehicleId.toString());
            router.push(`/dashboard/trip-segments?${newSearchParams.toString()}`);
        }
        if (tab === 'locations') {
            const locationId = heatMapData.data!.locations.find((loc) => loc.address === e.serieId)!.id;
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('locations');
            newSearchParams.append('locations', locationId.toString());
            router.push(`/dashboard/trip-segments?${newSearchParams.toString()}`);
        }
    };

    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer-${vehicles?.length ?? 'alle'}_koeretoejer`;
    const impliedCellHeight = 40;
    const impliedBaseHeight = 210;
    const vehicleHeight = impliedBaseHeight + (heatMapData.data?.vehicleGroup.km?.length || 1) * impliedCellHeight;
    const locationHeight = impliedBaseHeight + (heatMapData.data?.locationGroup.km?.length || 1) * impliedCellHeight;
    return (
        <div>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Grænseværdi
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Indstillingen nedenfor filtrerer data i grafen.
                </Typography>
                <TextField
                    label="Grænseværdi"
                    size="small"
                    className="subtle w-44"
                    value={colorThreshold}
                    onChange={(e) => {
                        setColorThreshold(e.target.value.includes(',') ? e.target.value.replace(',', '.') : e.target.value);
                    }}
                    slotProps={{
                        input: {
                            endAdornment: <InputAdornment position="end">km</InputAdornment>,
                        }
                    }}
                />
            </Paper>

            <div className="flex justify-end mb-2">
                <Button
                    href={`${AxiosBase.getUri()}${queryString.concat(`&threshold=${colorThreshold}`).substring(1)}&download=true`}
                    startIcon={<DownloadingIcon />}
                    variant="contained"
                    size="small"
                >
                    Eksporter til Excel
                </Button>
            </div>

            {heatMapData.isError && (
                <ApiError
                    retryFunction={() => {
                        if (heatMapData.isError) heatMapData.refetch();
                    }}
                >
                    Der opstod en netværksfejl
                </ApiError>
            )}
            {heatMapData.isPending && (
                <Card sx={{ p: 2 }}>
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="70%" sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" height={400} />
                </Card>
            )}
            {heatMapData.data && (
                <Card sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                        Køretøjsaktivitet
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        Køretøjsaktivitet viser hvor mange kilometer der er kørt i den valgte periode, enten samlet på lokationen eller enkeltvis pr køretøj. Skift mellem lokationer - og køretøjer fanen. Justér grænseværdien for at fremhæve lavere eller højere antal kørte kilometer. Hvis et felt er gråt indikerer det, at køretøjet har en igangværende tur, men ikke har været aktiv - altså står den stille et andet sted end sin hjemmelokation.
                    </Typography>
                    <TabContext value={tab}>
                        <div className="w-full border-b">
                            <TabList onChange={(event, value) => setTab(value)}>
                                <Tab label="Lokationer" value="locations" />
                                <Tab label="Køretøjer" value="vehicles" />
                            </TabList>
                        </div>
                        <TabPanel value="locations">
                            <div style={{ height: `${locationHeight}px` }}>
                                <DownloadableGraph filename={`loktaionsaktivitet-${fileNameAppendix}.png`}>
                                    <DrivingHeatmapKm
                                        setLocationZoom={goToLocation}
                                        data={heatMapData.data.locationGroup.km}
                                        maxHeatValue={isNaN(parseFloat(colorThreshold as string)) ? undefined : +colorThreshold}
                                    />
                                </DownloadableGraph>
                            </div>
                        </TabPanel>
                        <TabPanel value="vehicles">
                            <div style={{ height: `${vehicleHeight}px` }}>
                                <DownloadableGraph filename={`koeretoejsaktivitet-${fileNameAppendix}.png`}>
                                    <DrivingHeatmapKm
                                        setLocationZoom={goToLocation}
                                        data={heatMapData.data.vehicleGroup.km}
                                        maxHeatValue={isNaN(parseFloat(colorThreshold as string)) ? undefined : +colorThreshold}
                                    />
                                </DownloadableGraph>
                            </div>
                        </TabPanel>
                    </TabContext>
                </Card>
            )}
            {!heatMapData.data && !heatMapData.isPending && !heatMapData.isError && (
                <p className="m-4">Simuleringen blev afbrudt / Der er ingen kørselsdata for de valgte filtre.</p>
            )}
        </div>
    );
};

export default VehicleActivityDashboard;
