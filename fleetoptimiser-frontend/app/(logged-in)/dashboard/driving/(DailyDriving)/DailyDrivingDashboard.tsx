'use client';

import ApiError from '@/components/ApiError';
import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import { getInterval } from '../../../dashboard/ShiftNameTranslater';
import { filterProps } from '../../(filters)/FilterHeader';
import CombinedDailyDrivingGraph from '@/app/(logged-in)/dashboard/driving/(DailyDriving)/CombinedDailyDriving';
import { DownloadableGraph } from '@/components/DownloadableGraph';

const DailyDrivingDashboard = ({ availableshifts, start, end, departments, forvaltninger, locations, vehicles }: filterProps) => {
    const colors = ['#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];

    const fillDays = (data: { x: string; y: number }[], start: string, end: string) => {
        let dt = dayjs(start);
        const endDate = dayjs(end);
        let tempArr = [];
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

                    result[0].uniqueCars.find((id) => id === vehicle_id) ?? result[0].uniqueCars.push(vehicle_id);
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

                    result[shift_id].uniqueCars.find((id) => id === vehicle_id) ?? result[shift_id].uniqueCars.push(vehicle_id);
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
            for (let key in final) {
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

    return (
        <div>
            <h1 className="mb-4 text-xl">Kørte kilometer pr. dag</h1>
            {dashboardData.isError && <ApiError retryFunction={dashboardData.refetch}>Der opstod en netværksfejl</ApiError>}
            {dashboardData.isLoading && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {dashboardData.data &&
                (Object.keys(dashboardData.data).length > 0 ? (
                    <DownloadableGraph filename={`daglig_koersel-${fileNameAppendix}.png`}>
                        <CombinedDailyDrivingGraph
                            header="Daglig kørsel i vagtlag"
                            data={Object.keys(dashboardData.data).map((shiftKey) => dashboardData.data[shiftKey])}
                            colors={colors}
                        />
                    </DownloadableGraph>
                ) : (
                    <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                ))}
        </div>
    );
};

export default DailyDrivingDashboard;
