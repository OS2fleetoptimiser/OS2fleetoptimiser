'use client';

import ApiError from '@/components/ApiError';
import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { Box, Card, CircularProgress, Typography } from '@mui/material';
import MonthlyDrivingGraph from './MonthlyDrivingGraph';
import { getInterval } from '../../ShiftNameTranslater';
import dayjs from 'dayjs';
import { filterProps } from '../../(filters)/FilterHeader';
import getColorMapperFunc from '../colorUtils';
import { DownloadableGraph } from '@/components/DownloadableGraph';

const MonthlyDrivingDashboard = ({ availableshifts, end, start, departments, forvaltninger, locations, vehicles, shifts }: filterProps) => {
    const { queryObject: dashboardData } = useGetDrivingData({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        vehicleIds: vehicles,
        departments: departments,
        forvaltninger: forvaltninger,
        shiftsAggregate: availableshifts,
        asTripSegments: true,
        applyShiftFilter: true,
        selector: (data) => {
            if (!data.driving_data) return { uniqueVehicles: 0, totalDriven: 0, drivingData: [] };
            let totalDistance = 0;
            const uniqueVehicles: number[] = [];
            const result: {
                [monthYear: string]: { [shift: string]: number };
            } = {};
            data.driving_data.forEach((entry) => {
                const { shift_id, distance, start_time } = entry;
                let shiftName = 'Hele dagen';
                if (data.shifts && data.shifts.length > 0) {
                    const shift = data.shifts[shift_id];
                    shiftName = getInterval(shift.shift_start, shift.shift_end);
                }
                const year = new Date(start_time).getFullYear();
                const month = new Date(start_time).getMonth();
                const yearMonth = `${year}-${month + 1}`;
                if (!result[yearMonth]) {
                    result[yearMonth] = {};
                }
                if (!shifts || shifts.length === 0 || shifts.includes(shift_id)) {
                    if (!result[yearMonth][shiftName]) {
                        result[yearMonth][shiftName] = 0;
                    }
                    result[yearMonth][shiftName] += distance;
                    totalDistance += distance;
                    if (!uniqueVehicles.find((id) => id === entry.vehicle_id)) uniqueVehicles.push(entry.vehicle_id);
                }
            });

            return {
                uniqueVehicles: uniqueVehicles.length,
                totalDriven: totalDistance,
                drivingData: Object.keys(result).map((monthYear) => ({
                    monthYear: monthYear,
                    ...result[monthYear],
                })) as ({ monthYear: string } & { [shift: string]: number })[],
            };
        },
    });

    const shiftColorMapper = getColorMapperFunc(availableshifts);
    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer-${vehicles?.length ?? 'alle'}_koeretoejer`;

    return (
        <div>
            {dashboardData.isError && <ApiError retryFunction={dashboardData.refetch}>Der opstod en netværksfejl</ApiError>}
            {dashboardData.isPending && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {dashboardData.data && (
                dashboardData.data.drivingData.length > 0 ? (
                    <Card sx={{ p: 3 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Kørte kilometer pr. måned
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                            Grafen viser det samlede antal kørte kilometer pr. måned i den valgte periode.
                        </Typography>
                        <Box className="flex w-fit divide-x divide-gray-300 py-3 mb-4 rounded-lg" sx={{ bgcolor: '#fcfcfc' }}>
                            <div className="px-5">
                                <div className="text-xs text-gray-500">Kørte kilometer</div>
                                <div className="text-lg font-semibold">{Math.round(dashboardData.data.totalDriven).toLocaleString()} km</div>
                            </div>
                            <div className="px-5">
                                <div className="text-xs text-gray-500">Køretøjer i grafen</div>
                                <div className="text-lg font-semibold">{dashboardData.data.uniqueVehicles}</div>
                            </div>
                        </Box>
                        <div className="h-96">
                            <DownloadableGraph filename={`maanedelig_koersel-${fileNameAppendix}.png`}>
                                <MonthlyDrivingGraph data={dashboardData.data.drivingData} colorMapper={shiftColorMapper} />
                            </DownloadableGraph>
                        </div>
                    </Card>
                ) : (
                    <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                )
            )}
        </div>
    );
};

export default MonthlyDrivingDashboard;
