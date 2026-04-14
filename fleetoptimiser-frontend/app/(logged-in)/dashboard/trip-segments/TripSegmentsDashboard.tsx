'use client';

import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { Card, Divider, InputAdornment, Paper, Skeleton, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import ParkingTimeScatterPlot, { scatterplotProps } from './StopsParkingScatterPlot';
import TripSegmentGraph, { ogData } from './TripSegmentGraph';

import ApiError from '@/components/ApiError';
import RoundTripChart from './RoundTripGraph';
import { filterProps } from '../(filters)/FilterHeader';

const TripSegmentsDashboard = ({ availableshifts, end, start, departments, locations, forvaltninger, vehicles, shifts }: filterProps) => {
    const [distanceLimit, setDistanceLimit] = useState<number | undefined>(5);
    const [minParkingTime, setMinParkingTime] = useState<number | undefined>(0);
    const [focus, setFocus] = useState<string | undefined>(undefined);
    const [selectedRoundTrip, setSelectedRoundTrip] = useState<number | undefined>(undefined);

    const { queryObject: drivingData } = useGetDrivingData({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        departments: departments,
        forvaltninger: forvaltninger,
        vehicleIds: vehicles,
        shiftsAggregate: availableshifts,
        includeTripSegments: true,
        shiftFilter: shifts,
        applyShiftFilter: true,
        selector: (data) => {
            //Add shift filter
            if (!data.driving_data) {
                return {
                    barChart: [],
                    stopParkingPlot: [],
                    distanceParkingPlot: [],
                };
            }
            const completeRoundtrip = data.driving_data.filter(
                (roundtrip) => roundtrip.aggregation_type != null && roundtrip.aggregation_type.includes('complete')
            );
            const underDistanceLimit = completeRoundtrip.filter((roundtrip) => roundtrip.distance < (distanceLimit ?? 0) && roundtrip.distance > 0.2);

            const barChartData: ogData = [];
            const stopsParkingScatterPlotData: scatterplotProps = [];
            const distanceParkingScatterPlotData: scatterplotProps = [];

            underDistanceLimit.forEach((curr) => {
                if (!shifts || shifts.length === 0 || shifts.includes(curr.shift_id)) {
                    const drivingTime =
                        curr.trip_segments.length <= 1
                            ? dayjs(curr.end_time).diff(dayjs(curr.start_time), 'm')
                            : curr.trip_segments.reduce(
                                  (drivingTimeAcc, segment) => drivingTimeAcc + dayjs(segment.end_time).diff(dayjs(segment.start_time), 'm'),
                                  0
                              );
                    const parkedTime = dayjs(curr.end_time).diff(dayjs(curr.start_time), 'm') - drivingTime;
                    if (!minParkingTime || parkedTime >= minParkingTime) {
                        const stops = curr.trip_segments.length === 0 ? 0 : curr.trip_segments.length - 1;

                        const stopParkingEntry = {
                            tripId: curr.roundtrip_id,
                            distance: curr.distance,
                            stops: stops,
                            parkingTime: parkedTime,
                            x: stops,
                            y: parkedTime,
                            date: dayjs(curr.start_time).format('DD/MM/YYYY HH:mm'),
                            name: `${curr.department} ${curr.plate}`,
                        };
                        const distanceParkingEntry = {
                            tripId: curr.roundtrip_id,
                            distance: curr.distance,
                            stops: stops,
                            parkingTime: parkedTime,
                            x: curr.distance,
                            y: parkedTime,
                            date: dayjs(curr.start_time).format('DD/MM/YYYY HH:mm'),
                            name: `${curr.department} ${curr.plate}`,
                        };

                        const existingBarChartEntry = barChartData.find((entry) => entry.vehicle === curr.plate);
                        if (existingBarChartEntry) {
                            existingBarChartEntry.Ture++;
                        } else {
                            barChartData.push({
                                vehicle: curr.plate,
                                department: curr.department,
                                Ture: 1,
                            });
                        }

                        stopsParkingScatterPlotData.push({
                            id: curr.plate,
                            data: [stopParkingEntry],
                        });

                        distanceParkingScatterPlotData.push({
                            id: curr.plate,
                            data: [distanceParkingEntry],
                        });
                    }
                }
            });

            return {
                barChart: barChartData,
                stopParkingPlot: stopsParkingScatterPlotData,
                distanceParkingPlot: distanceParkingScatterPlotData,
                tripSegments: underDistanceLimit,
            };
        },
    });

    const selectedTripSegments =
        selectedRoundTrip && drivingData.data?.tripSegments ? drivingData.data.tripSegments.find((trip) => trip.roundtrip_id === selectedRoundTrip) : undefined;
    const selectedVehicle =
        selectedRoundTrip && drivingData.data?.tripSegments
            ? drivingData.data.tripSegments.find((roundtrip) => roundtrip.roundtrip_id === selectedRoundTrip)
            : undefined;
    const currentVehicle = `${selectedVehicle?.plate} ${selectedVehicle?.make} ${selectedVehicle?.model}`;

    return (
        <div>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Grænseværdier
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Indstillingerne nedenfor filtrerer data i alle grafer på denne side.
                </Typography>
                <div className="flex gap-4">
                    <TextField
                        size="small"
                        className="subtle w-44"
                        label="Maks tur distance"
                        value={distanceLimit}
                        onBlur={() => {
                            if (distanceLimit === undefined) setDistanceLimit(0);
                        }}
                        onChange={(e) => setDistanceLimit(isNaN(Number.parseFloat(e.target.value)) ? undefined : +e.target.value)}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">km</InputAdornment>,
                            }
                        }}
                    />
                    <TextField
                        size="small"
                        label="Minimum parkeringstid"
                        className="subtle w-44"
                        value={minParkingTime}
                        onBlur={() => {
                            if (minParkingTime === undefined) setDistanceLimit(0);
                        }}
                        onChange={(e) => setMinParkingTime(isNaN(Number.parseFloat(e.target.value)) ? undefined : +e.target.value)}
                        slotProps={{
                            input: {
                                endAdornment: <InputAdornment position="end">min</InputAdornment>,
                            }
                        }}
                    />
                </div>
            </Paper>
            {drivingData.isError && <ApiError retryFunction={drivingData.refetch}>Der opstod en netværksfejl</ApiError>}
            {drivingData.isPending && (
                <Card sx={{ p: 2 }}>
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="70%" sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" height={500} />
                </Card>
            )}
            {drivingData.data &&
                (drivingData.data.barChart.length > 0 ? (
                    <>
                        <Card sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                                Turoverblik
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                Turoverblik viser en samling af kvalificeret godkendte rundture, som er under grænseværdien; maks tur distance og over grænseværdien; minimum parkeringstid. Der vises antal ture pr. køretøj, som fremhæves i de detaljeret grafer under. Klik på en enkelt rundtur for at se længden på rundturens kørsels - og parkeringssegmenter.
                            </Typography>
                            <div className="h-[500px]">
                                <TripSegmentGraph focus={focus} setFocus={setFocus} data={drivingData.data.barChart}></TripSegmentGraph>
                            </div>
                        </Card>
                        <div className="flex gap-4 my-4">
                            <Card sx={{ p: 2, flex: 1 }}>
                                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 2 }}>
                                    Stop / Parkeringstid
                                </Typography>
                                <div className="h-96">
                                    <ParkingTimeScatterPlot
                                        setSelected={setSelectedRoundTrip}
                                        focus={focus}
                                        setFocus={setFocus}
                                        distance={false}
                                        data={drivingData.data.stopParkingPlot}
                                    ></ParkingTimeScatterPlot>
                                </div>
                            </Card>
                            <Card sx={{ p: 2, flex: 1 }}>
                                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 2 }}>
                                    Distance / Parkeringstid
                                </Typography>
                                <div className="h-96">
                                    <ParkingTimeScatterPlot
                                        setSelected={setSelectedRoundTrip}
                                        focus={focus}
                                        setFocus={setFocus}
                                        distance={true}
                                        data={drivingData.data.distanceParkingPlot}
                                    ></ParkingTimeScatterPlot>
                                </div>
                            </Card>
                        </div>
                    </>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ m: 2 }}>
                        Der er ingen data der matcher de valgte filtre. Du kan forsøge at sætte maks tur distancen op hvis der er kørt ture i den valgte
                        periode.
                    </Typography>
                ))}
            {selectedTripSegments && (
                <div className="h-[500px] mb-4">
                    <RoundTripChart currentVehicle={currentVehicle} segmentData={selectedTripSegments.trip_segments} />
                </div>
            )}
        </div>
    );
};

export default TripSegmentsDashboard;
