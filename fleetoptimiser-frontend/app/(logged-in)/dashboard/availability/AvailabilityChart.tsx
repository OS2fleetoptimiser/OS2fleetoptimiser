'use client';

import React from 'react';
import { useGetVehicleAvailability } from '@/components/hooks/useGetDrivingData';
import dayjs from 'dayjs';
import { Card, CardContent, CircularProgress, Typography } from '@mui/material'

import { filterProps } from '../(filters)/FilterHeader';
import { AvailabilityGraph } from '@/app/(logged-in)/dashboard/availability/AvailabilityGraph';
import { DownloadableGraph } from "@/components/DownloadableGraph";

const AvailabilityHighlightCard = ({ title, value }: { title: string; value: string | number }) => {
    return (
        <Card className="flex-1 min-w-0">
            <CardContent className="space-y-2">
                <div className="text-sm">{title}</div>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

export default function AvailabilityChart({ start, end, locations, departments, forvaltninger, vehicles }: filterProps) {
    const vehicle_availability = useGetVehicleAvailability({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        departments: departments,
        forvaltninger: forvaltninger,
        vehicleIds: vehicles,
    });
    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer-${vehicles?.length ?? 'alle'}_koeretoejer`;
    return (
        <div>
            {vehicle_availability.isPending && (
                <div className="flex justify-center items-center h-[500px]">
                    <CircularProgress></CircularProgress>
                </div>
            )}
            {vehicle_availability.data && (
                <>
                    <div className="flex flex-wrap my-4 items-center gap-4">
                        <AvailabilityHighlightCard title="Antal køretøjer" value={vehicle_availability.data.totalVehicles} />
                        <AvailabilityHighlightCard title="Størst ledighed" value={vehicle_availability.data.maxAvailability} />
                        <AvailabilityHighlightCard title="Mindst ledighed" value={vehicle_availability.data.leastAvailability} />
                        <AvailabilityHighlightCard title="Gennemsnitlig ledighed" value={vehicle_availability.data.averageAvailability} />
                    </div>
                    <Card sx={{ p: 2 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Ledighedsgraf
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                            Grafen viser kapaciteten for puljen over de valgte køretøjer i den valgte periode. For hvert tidspunkt vises det antal af køretøjer, der var ledige på det pågældende tidspunkt. Hvis køretøjet ikke har en igangværende rundtur på tidspunktet, antages den som værende ledig. Der tages et gennemsnit af ledige køretøjer over 5 minutters interval. OBS: køretøjet kan stå som ledig, hvis rundturen ikke er komplet.
                        </Typography>
                        <div className="h-[500px]">
                            <DownloadableGraph filename={`ledighedsgraf-${fileNameAppendix}.png`}>
                                <AvailabilityGraph totalVehicles={vehicle_availability.data.totalVehicles} data={vehicle_availability.data.data} />
                            </DownloadableGraph>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}
