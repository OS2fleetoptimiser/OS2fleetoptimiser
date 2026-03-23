'use client';

import ApiError from '@/components/ApiError';
import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { Box, Card, CircularProgress, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { getInterval } from '../../../dashboard/ShiftNameTranslater';
import { filterProps } from '../../(filters)/FilterHeader';
import CombinedDailyDrivingGraph from '@/app/(logged-in)/dashboard/driving/(DailyDriving)/CombinedDailyDriving';
import { DownloadableGraph } from '@/components/DownloadableGraph';
import getColorMapperFunc from "@/app/(logged-in)/dashboard/driving/colorUtils";

const DailyDrivingDashboard = ({ availableshifts, start, end, departments, forvaltninger, locations, vehicles }: filterProps) => {
    const fillDays = (data: { x: string; y: number }[], start: string, end: string) => {
        let dt = dayjs(start);
        const endDate = dayjs(end);
        const tempArr = [];
        while (dt <= endDate) {
            tempArr.push(dt);
            dt = dt.add(1, 'day');
        }
        return tempArr.map((date) => ({
            x: date.format('YYYY-MM-DD'),
            y: data.find(({ x, y }) => x == date.format('YYYY-MM-DD'))?.y ?? 0,
        }));
    };

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
            if (!data.driving_data) return {};

            const result: { uniqueCars: number[]; data: { x: string; y: number }[] }[] = [];

            if (data.shifts === null || data.shifts.length === 0) {
                result[0] = {
                    uniqueCars: [],
                    data: [],
                };
                data.driving_data.forEach((item) => {
                    const { distance, start_time, vehicle_id } = item;

                    result[0].data.push({
                        x: dayjs(start_time).format('YYYY-MM-DD'),
                        y: distance,
                    });

                    if (!result[0].uniqueCars.find((id) => id === vehicle_id)) result[0].uniqueCars.push(vehicle_id);
                });
            } else {
                for (let i = 0; i < data.shifts.length; i++) {
                    result[i] = {
                        uniqueCars: [],
                        data: [],
                    };
                }
                data.driving_data.forEach((item) => {
                    const { shift_id, distance, start_time, vehicle_id } = item;

                    result[shift_id].data.push({
                        x: dayjs(start_time).format('YYYY-MM-DD'),
                        y: distance,
                    });

                    if (!result[shift_id].uniqueCars.find((id) => id === vehicle_id)) result[shift_id].uniqueCars.push(vehicle_id);
                });
            }

            const final: {
                [shift: string]: {
                    id: string;
                    uniqueCars: number;
                    data: { x: string; y: number }[];
                };
            } = {};

            result.forEach((v, i) => {
                const shiftKey =
                    data.shifts === null || data.shifts.length === 0 ? 'Hele dagen' : getInterval(data.shifts[i].shift_start, data.shifts[i].shift_end);
                final[shiftKey] = {
                    id: shiftKey,
                    uniqueCars: v.uniqueCars.length,
                    data: v.data.sort((a, b) => dayjs(a.x).unix() - dayjs(b.x).unix()),
                };
            });

            // Find the first and last day for all shifts. Pick the biggest and smallest
            const startDates: string[] = [];
            const endDates: string[] = [];
            for (const key in final) {
                if (final[key].data.length === 0) {
                    continue;
                }
                startDates.push(final[key].data[0].x);
                endDates.push(final[key].data[final[key].data.length - 1].x);
            }
            const firstDate = startDates.reduce((first, current) => {
                return dayjs(first) < dayjs(current) ? first : current;
            }, startDates[0]);
            const lastDate = endDates.reduce((last, current) => {
                return dayjs(last) > dayjs(current) ? last : current;
            }, startDates[0]);

            // Fill holes in dates
            Object.keys(final).forEach((key) => {
                final[key].data = fillDays(final[key].data, firstDate, lastDate);
            });

            return final;
        },
    });
    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer`;
    const shiftColorMapper = getColorMapperFunc(availableshifts);

    return (
        <div>
            {dashboardData.isError && <ApiError retryFunction={dashboardData.refetch}>Der opstod en netværksfejl</ApiError>}
            {dashboardData.isPending && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {dashboardData.data &&
                (Object.keys(dashboardData.data).length > 0 ? (
                    <Card sx={{ p: 3 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Kørte kilometer pr. dag
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                            Grafen viser det samlede antal kørte kilometer pr. dag i den valgte periode. Grafen opdeles på dagsbasis ved perioder under 31 dage, ugebasis under 90 dage og månedsbasis ved længere perioder.
                        </Typography>
                        <Box className="flex w-fit divide-x divide-gray-300 py-3 mb-4 rounded-lg" sx={{ bgcolor: '#fcfcfc' }}>
                            {Object.keys(dashboardData.data).map((shiftKey) => {
                                const series = dashboardData.data[shiftKey]
                                const avg = series.data.length > 0
                                    ? Math.round(series.data.reduce((sum, p) => sum + p.y, 0) / series.data.length)
                                    : 0
                                return (
                                    <div key={shiftKey} className="px-5">
                                        <div className="text-xs text-gray-500">{series.id}</div>
                                        <div className="text-lg font-semibold">{avg.toLocaleString()} km/dag</div>
                                        <div className="text-xs text-gray-400">{series.uniqueCars} køretøjer</div>
                                    </div>
                                )
                            })}
                        </Box>
                        <div className="h-96">
                            <DownloadableGraph filename={`daglig_koersel-${fileNameAppendix}.png`}>
                                <CombinedDailyDrivingGraph
                                    data={Object.keys(dashboardData.data).map((shiftKey) => dashboardData.data[shiftKey])}
                                    colorMapper={shiftColorMapper}
                                />
                            </DownloadableGraph>
                        </div>
                    </Card>
                ) : (
                    <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                ))}
        </div>
    );
};

export default DailyDrivingDashboard;
