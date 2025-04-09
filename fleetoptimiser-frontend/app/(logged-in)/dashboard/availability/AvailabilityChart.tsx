'use client';

import React from 'react';
import { useGetVehicleAvailability } from '@/components/hooks/useGetDrivingData';
import dayjs from 'dayjs';
import { ResponsiveLineCanvas } from '@nivo/line';
import { CircularProgress } from '@mui/material';
import { filterProps } from '../(filters)/FilterHeader';
import Typography from "@mui/material/Typography";
import { getYTicks } from "@/app/(logged-in)/fleet/UnallocatedTripsLine";

export default function AvailabilityChart({ start, end, locations, departments, forvaltninger, vehicles }: filterProps) {
    const vehicle_availability = useGetVehicleAvailability({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        departments: departments,
        forvaltninger: forvaltninger,
        vehicleIds: vehicles,
    });

    return (
        <div>
            {vehicle_availability.isLoading && (
                <div className="flex justify-center items-center h-[500px]">
                    <CircularProgress></CircularProgress>
                </div>
            )}
            {vehicle_availability.data && (
                <>
                    <div className="flex my-8 items-center">
                        <div className="bg-white custom-nav p-4 w-44">
                            <Typography variant="h4" className="mb-4">Antal køretøjer</Typography>
                            <Typography variant="h2" className="text-blue-500 font-bold">{vehicle_availability.data.totalVehicles}</Typography>
                        </div>
                        <div className="bg-white custom-nav p-4 w-44 mx-12">
                            <Typography variant="h4" className="mb-4">Størst ledighed</Typography>
                            <Typography variant="h2" className="text-blue-500 font-bold">{vehicle_availability.data.maxAvailability}</Typography>
                        </div>
                        <div className="bg-white custom-nav p-4 w-44">
                            <Typography variant="h4" className="mb-4">Mindst ledighed</Typography>
                            <Typography variant="h2" className="text-blue-500 font-bold">{vehicle_availability.data.leastAvailability}</Typography>
                        </div>
                        <div className="bg-white custom-nav p-4 mx-12">
                            <Typography variant="h4" className="mb-4">Gennemsnitlig ledighed</Typography>
                            <Typography variant="h2" className="text-blue-500 font-bold">{vehicle_availability.data.averageAvailability}</Typography>
                        </div>
                        <div>
                            <p className="text-explanation text-xs ml-4 block w-96">Grafen viser kapaciteten for puljen over de valgte køretøjer i den valgte periode. For hvert tidspunkt vises det antal af køretøjer, der var ledige på det pågældende tidspunkt. Hvis køretøjet ikke har en igangværende rundtur på tidspunktet, antages den som værende ledig. Der tages et gennemsnit af ledige køretøjer over 5 minutters interval. OBS: køretøjet kan stå som ledig, hvis rundturen ikke er komplet.</p>
                        </div>
                    </div>
                    <div className="h-[500px] bg-white custom-nav p-8">
                        <ResponsiveLineCanvas
                            data={[{ id: 'Ledighed', data: vehicle_availability.data.data }]}
                            margin={{ top: 20, right: 80, bottom: 120, left: 80 }}
                            yScale={{
                                type: 'linear',
                                stacked: false,
                            }}
                            xScale={{
                                type: 'time',
                                format: '%Y-%m-%dT%H:%M:%S',
                                useUTC: false,
                                precision: 'minute',
                            }}
                            xFormat="time:%Y-%m-%d %H:%M:%S"
                            axisLeft={{
                                legend: 'Antal ledige køretøjer',
                                legendOffset: -60,
                                legendPosition: 'middle',
                                tickValues: getYTicks([vehicle_availability.data.totalVehicles])
                            }}
                            axisBottom={{
                                // tickValues: 'every 10 hours',
                                legend: 'Tidspunkt',
                                legendOffset: 100,
                                legendPosition: 'middle',
                                tickRotation: 45,
                                format: (x: Date) => x.toLocaleString(),
                            }}
                            colors='rgba(59,130,246,0.8)'
                            isInteractive={true}
                            pointSize={0}
                        ></ResponsiveLineCanvas>
                    </div>
                </>
            )}
        </div>
    );
}
