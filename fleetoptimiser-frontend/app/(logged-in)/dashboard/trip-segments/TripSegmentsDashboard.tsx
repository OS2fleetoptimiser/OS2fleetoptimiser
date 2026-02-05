'use client';

import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { CircularProgress, InputAdornment, TextField, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import ParkingTimeScatterPlot, { scatterplotProps } from './StopsParkingScatterPlot';
import TripSegmentGraph, { ogData } from './TripSegmentGraph';
import { getInterval } from '../ShiftNameTranslater';
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

            const shiftNames = data.shifts.map((shift) => getInterval(shift.shift_start, shift.shift_end));

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
            <TextField
                className="mx-4 subtle w-44 my-8"
                label="Maks tur distance"
                value={distanceLimit}
                onBlur={(e) => {
                    if (distanceLimit === undefined) setDistanceLimit(0);
                }}
                onChange={(e) => setDistanceLimit(isNaN(Number.parseFloat(e.target.value)) ? undefined : +e.target.value)}
                slotProps={{
                    input: {
                        endAdornment: <InputAdornment position="end">km</InputAdornment>,
                    }
                }}
            ></TextField>
            <TextField
                label="Minimum parkeringstid"
                className="subtle w-44 my-8"
                value={minParkingTime}
                onBlur={(e) => {
                    if (minParkingTime === undefined) setDistanceLimit(0);
                }}
                onChange={(e) => setMinParkingTime(isNaN(Number.parseFloat(e.target.value)) ? undefined : +e.target.value)}
                slotProps={{
                    input: {
                        endAdornment: <InputAdornment position="end">min</InputAdornment>,
                    }
                }}
            ></TextField>
            <div className="w-96 inline-flex mb-8 mt-6">
                <span className="text-explanation text-xs ml-4 w-96">Turoverblik viser en samling af kvalificeret godkendte rundture, som er under grænseværdien; maks tur distance og over grænseværdien; minimum parkeringstid. Der vises antal ture pr. køretøj, som fremhæves i de detaljeret grafer under. Klik på en enkelt rundtur for at se længden på rundturens kørsels - og parkeringssegmenter.</span>
            </div>
            {drivingData.isError && <ApiError retryFunction={drivingData.refetch}>Der opstod en netværksfejl</ApiError>}
            {drivingData.isLoading && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {drivingData.data &&
                (drivingData.data.barChart.length > 0 ? (
                    <>
                        <div className="h-[500px] mb-4">
                            <TripSegmentGraph focus={focus} setFocus={setFocus} data={drivingData.data.barChart}></TripSegmentGraph>
                        </div>
                        <div className="my-8 flex">
                            <div className="w-1/2">
                                <h3 className="text-center">Stop / Parkeringstid</h3>
                                <div className="h-96">
                                    <ParkingTimeScatterPlot
                                        setSelected={setSelectedRoundTrip}
                                        focus={focus}
                                        setFocus={setFocus}
                                        distance={false}
                                        data={drivingData.data.stopParkingPlot}
                                    ></ParkingTimeScatterPlot>
                                </div>
                            </div>
                            <div className="w-1/2">
                                <h3 className="text-center">Distance / Parkeringstid</h3>
                                <div className="h-96">
                                    <ParkingTimeScatterPlot
                                        setSelected={setSelectedRoundTrip}
                                        focus={focus}
                                        setFocus={setFocus}
                                        distance={true}
                                        data={drivingData.data.distanceParkingPlot}
                                    ></ParkingTimeScatterPlot>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="m-4">
                        Der er ingen data der matcher de valgte filtre. Du kan forsøge at sætte maks tur distancen op hvis der er kørt ture i den valgte
                        periode.
                    </p>
                ))}
            <div className="h-[500px] mb-4">
                <RoundTripChart currentVehicle={currentVehicle} segmentData={selectedTripSegments?.trip_segments} />
            </div>
        </div>
    );
};

export default TripSegmentsDashboard;
