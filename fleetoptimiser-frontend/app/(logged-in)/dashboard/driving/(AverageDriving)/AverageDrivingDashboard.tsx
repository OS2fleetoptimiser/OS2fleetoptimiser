'use client';

import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { CircularProgress } from '@mui/material';
import { drivingData } from '@/components/hooks/useGetDrivingData';
import { getInterval } from '../../../dashboard/ShiftNameTranslater';
import AverageDrivingGraph from './AverageDrivingGraph';
import ApiError from '@/components/ApiError';
import dayjs from 'dayjs';
import { filterProps } from '../../(filters)/FilterHeader';
import getColorMapperFunc from '../colorUtils';
import { DownloadableGraph } from '@/components/DownloadableGraph';

const AverageDrivingDashboard = ({ availableshifts, end, locations, forvaltninger, start, departments, vehicles, shifts }: filterProps) => {
    const { queryObject: drivingData } = useGetDrivingData({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        departments: departments,
        forvaltninger: forvaltninger,
        vehicleIds: vehicles,
        shiftsAggregate: availableshifts,
        asTripSegments: true,
        shiftFilter: shifts,
        applyShiftFilter: true,
        selector: (data) => {
            if (!data.driving_data)
                return {
                    keys: data.shifts?.length > 0 ? data.shifts.map((shift) => getInterval(shift.shift_start, shift.shift_end)) : ['Hele dagen'],
                    dataPoints: [],
                };

            const groupedByPlate = data.driving_data.reduce((acc, data) => {
                let existing = acc.find((car) => car.vehicle_id == data.vehicle_id && car.plate === data.plate && car.department === data.department);
                if (existing) {
                    existing.trips.push(data);
                } else {
                    acc.push({ vehicle_id: data.vehicle_id, plate: data.plate, department: data.department, trips: [data] });
                }
                return acc;
            }, [] as { vehicle_id: number; plate: string; department: string; trips: drivingData[] }[]);

            let dataPoints = [];

            // For each car get trips for each shift and get average length over days
            for (let i = 0; i < groupedByPlate.length; i++) {
                let car = groupedByPlate[i];
                let dataEntry = {
                    vehicle_id: car.vehicle_id,
                    plate: car.plate,
                    department: car.department, // Adding the department here
                } as { vehicle_id: number; plate: string; department: string } & { [key: string]: number };
                if (data.shifts.length === 0 || !data.shifts) {
                    let minDate = car.trips.reduce((acc, data) => {
                        return new Date(data.start_time) < acc ? new Date(data.start_time) : acc;
                    }, new Date('3000-01-01'));

                    let maxDate = car.trips.reduce((acc, data) => {
                        return new Date(data.start_time) > acc ? new Date(data.start_time) : acc;
                    }, new Date('1000-01-01'));

                    let totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                    totalDays = totalDays != 0 ? totalDays : 1;
                    const averageDistance = car.trips.reduce((sum, data) => sum + data.distance, 0) / totalDays;
                    if (averageDistance > 0) dataEntry['Hele dagen'] = averageDistance;
                } else {
                    for (let j = 0; j < data.shifts.length; j++) {
                        let tripsInShift = car.trips.reduce((acc: drivingData[], trip) => {
                            if (trip.shift_id === j) acc.push(trip);
                            return acc;
                        }, []);

                        let minDate = tripsInShift.reduce((acc, data) => {
                            return new Date(data.start_time) < acc ? new Date(data.start_time) : acc;
                        }, new Date('3000-01-01'));

                        let maxDate = tripsInShift.reduce((acc, data) => {
                            return new Date(data.start_time) > acc ? new Date(data.start_time) : acc;
                        }, new Date('1000-01-01'));

                        let totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24));
                        totalDays = totalDays != 0 ? totalDays : 1;
                        const averageDistance = tripsInShift.reduce((sum, data) => sum + data.distance, 0) / totalDays;
                        let shiftName = 'Hele dagen';
                        shiftName = getInterval(data.shifts[j].shift_start, data.shifts[j].shift_end);
                        if (averageDistance > 0) dataEntry[shiftName] = averageDistance;
                    }
                }
                dataPoints.push(dataEntry);
            }
            // Because we only add keys if the average driving is above 0 we can filter out vehicles that hasn't driven by checking the amount of keys.
            //The first key will always be the plate
            return {
                keys: data.shifts?.length > 0 ? data.shifts.map((shift) => getInterval(shift.shift_start, shift.shift_end)) : ['Hele dagen'],
                dataPoints: dataPoints.filter((point) => Object.keys(point).length > 1),
            };
        },
    });

    const shiftColorMapper = getColorMapperFunc(availableshifts);
    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer-${vehicles?.length ?? 'alle'}_koeretoejer`;

    return (
        <div>
            <h1 className="mb-4 text-xl">Gennemsnitlig kørte kilometer for kørte dage i valgte periode</h1>
            {drivingData.data && (
                <div className="text-center shadow-md p-4 w-fit">
                    <h4>Køretøjer der indgår i grafen</h4>
                    <p>{drivingData.data.dataPoints.length}</p>
                </div>
            )}
            {drivingData.isError && <ApiError retryFunction={drivingData.refetch}>Der opstod en netværksfejl</ApiError>}
            {drivingData.isLoading && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {drivingData.data &&
                (drivingData.data.dataPoints.length > 0 ? (
                    <div className="h-96">
                        <DownloadableGraph filename={`gennemsnitlig_koersel-${fileNameAppendix}.png`}>
                            <AverageDrivingGraph data={drivingData.data.dataPoints} keys={drivingData.data.keys} colorMapper={shiftColorMapper} />
                        </DownloadableGraph>
                    </div>
                ) : (
                    <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                ))}
        </div>
    );
};

export default AverageDrivingDashboard;
