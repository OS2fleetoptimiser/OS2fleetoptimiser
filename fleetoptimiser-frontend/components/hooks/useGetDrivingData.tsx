import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import AxiosBase from '../AxiosBase';
import {shift} from './useGetSettings';
import {useEffect, useRef} from "react";

export type drivingData = {
    vehicle_id: number;
    location_id: number;
    roundtrip_id: number;
    shift_id: number;
    start_time: string;
    end_time: string;
    distance: number;
    plate: string;
    make: string;
    model: string;
    aggregation_type: 'complete' | null;
    trip_segments: any[];
    department: string;
};

type location = {
    id: number;
    address: string;
};

type vehicle = {
    id: number;
    name: string;
    location_id: number;
};

export type drivingDataResult = {
    query_start_date: string;
    query_end_date: string;
    query_locations: location[];
    query_vehicles: vehicle[];
    shifts: {
        shift_start: string;
        shift_end: string;
        shift_break: string | null;
    }[];
    driving_data: drivingData[];
    timedelta: { [id: number]: { [date: string]: { timeSpent: number; timePossible: number } } };
};

interface inputParameters<T> {
    startPeriod?: Dayjs | null;
    endPeriod?: Dayjs | null;
    locationIds?: number[];
    vehicleIds?: number[];
    departments?: string[];
    forvaltninger?: string[];
    shiftsAggregate?: shift[];
    includeTripSegments?: boolean;
    selector?: (data: drivingDataResult) => T;
    shiftFilter?: number[];
    asTripSegments?: boolean;
    apply?: number;
    enabled?: boolean;
    applyShiftFilter?: boolean;
    timeDelta?: boolean;
}

interface groupedInputParameters<T> {
    startPeriod: Dayjs | null;
    endPeriod: Dayjs | null;
    locationIds?: number[];
    vehicleIds?: number[];
    departments?: string[];
    forvaltninger?: string[];
    shiftsAggregate?: shift[];
    includeTripSegments?: boolean;
    selector?: (data: groupedDrivingDataResult) => T;
    shiftFilter?: number[];
    asTripSegments?: boolean;
    selectedShifts?: number[];
    apply?: number;
}

type plotActivityPoint = {
    x: string;
    y: number;
    startDate: Dayjs;
    endDate: Dayjs;
    active: boolean;
};

type vehicleLocationPlotData = {
    id: string;
    idInt?: number;
    data: plotActivityPoint[];
};

export type groupedDrivingDataResult = {
    query_start_date: number;
    query_end_date: number;
    query_locations: location[];
    query_vehicles: vehicle[];
    shifts: {
        shift_start: string;
        shift_end: string;
        shift_break: string | null;
    }[];
    vehicle_grouped: vehicleLocationPlotData[];
    location_grouped: vehicleLocationPlotData[];
};

export function useGetVehicleAvailability<T>({
    startPeriod,
    endPeriod,
    locationIds,
    forvaltninger,
    vehicleIds,
    shiftFilter,
    departments,
    shiftsAggregate,
}: inputParameters<T>) {
    const searchParams = new URLSearchParams();
    searchParams.append('start_date', startPeriod ? startPeriod.format('YYYY-MM-DD') : dayjs().add(-7, 'day').format('YYYY-MM-DD'));
    searchParams.append('end_date', endPeriod ? endPeriod.add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    if (locationIds) {
        for (const locationId of locationIds) {
            searchParams.append('locations', locationId.toString());
        }
    }

    if (vehicleIds) {
        for (const vehicleId of vehicleIds) {
            searchParams.append('vehicles', vehicleId.toString());
        }
    }

    if (departments) {
        for (const department of departments) {
            searchParams.append('departments', department);
        }
    }

    if (shiftsAggregate) {
        for (const shift of shiftsAggregate) {
            searchParams.append('shifts', JSON.stringify(shift));
        }
    }

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    if (shiftFilter) {
        for (const id of shiftFilter) {
            searchParams.append('shift_filter', id.toString());
        }
    }

    const queryObject = useQuery({
        queryKey: ['vehicle availability', searchParams.toString()],

        queryFn: async () => {
            const result = await AxiosBase.get<{
                totalVehicles: number;
                maxAvailability: number;
                leastAvailability: number;
                averageAvailability: number;
                data: { x: string; y: number }[];
            }>(`/statistics/availability?${searchParams.toString()}`);
            return result.data;
        },

        refetchOnWindowFocus: false
    });

    return queryObject;
}

export function useGetGroupedDrivingData<TData = groupedDrivingDataResult>({
    startPeriod,
    endPeriod,
    locationIds,
    forvaltninger,
    vehicleIds,
    departments,
    shiftsAggregate: shifts,
    includeTripSegments,
    selector,
    asTripSegments,
    selectedShifts,
}: groupedInputParameters<TData>) {
    const searchParams = new URLSearchParams();
    searchParams.append('start_date', startPeriod ? startPeriod.format('YYYY-MM-DD') : dayjs().add(-7, 'day').format('YYYY-MM-DD'));
    searchParams.append('end_date', endPeriod ? endPeriod.add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
    if (includeTripSegments) searchParams.append('trip_segments', includeTripSegments + '');
    if (asTripSegments) searchParams.append('as_segments', asTripSegments + '');

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    if (locationIds) {
        for (const locationId of locationIds) {
            searchParams.append('locations', locationId.toString());
        }
    }

    if (vehicleIds) {
        for (const vehicleId of vehicleIds) {
            searchParams.append('vehicles', vehicleId.toString());
        }
    }

    if (selectedShifts) {
        for (const shift of selectedShifts) {
            searchParams.append('selected_shifts', shift.toString());
        }
    }

    if (departments) {
        for (const department of departments) {
            searchParams.append('departments', department);
        }
    }

    if (shifts) {
        for (const shift of shifts) {
            searchParams.append('shifts', JSON.stringify(shift));
        }
    }

    const queryString = `/statistics/grouped-driving-data?${searchParams.toString()}`;

    const queryObject = useQuery({
        queryKey: ['groupedDrivingData', searchParams.toString()],

        queryFn: async () => {
            const result = await AxiosBase.get<groupedDrivingDataResult>(queryString);
            return result.data;
        },

        select: selector,
        refetchOnWindowFocus: false
    });

    return {queryObject, queryString};
}

function useGetDrivingData<TData = drivingDataResult>({
    startPeriod,
    endPeriod,
    locationIds,
    forvaltninger,
    vehicleIds,
    departments,
    shiftsAggregate: shifts,
    includeTripSegments,
    selector,
    shiftFilter,
    asTripSegments,
    apply,
    applyShiftFilter,
    timeDelta,
}: inputParameters<TData>) {
    const searchParams = new URLSearchParams();
    searchParams.append('start_date', startPeriod ? startPeriod.format('YYYY-MM-DD') : dayjs().add(-7, 'day').format('YYYY-MM-DD'));
    searchParams.append('end_date', endPeriod ? endPeriod.add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
    if (includeTripSegments) searchParams.append('trip_segments', includeTripSegments + '');
    if (asTripSegments) searchParams.append('as_segments', asTripSegments + '');
    if (timeDelta) searchParams.append('with_timedelta', timeDelta + '');

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    if (locationIds) {
        for (const locationId of locationIds) {
            searchParams.append('locations', locationId.toString());
        }
    }

    if (vehicleIds) {
        for (const vehicleId of vehicleIds) {
            searchParams.append('vehicles', vehicleId.toString());
        }
    }

    if (departments) {
        for (const department of departments) {
            searchParams.append('departments', department);
        }
    }

    if (shifts) {
        for (const shift of shifts) {
            searchParams.append('shifts', JSON.stringify(shift));
        }
    }

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    if (shiftFilter) {
        for (const id of shiftFilter) {
            searchParams.append('shift_filter', id.toString());
        }
    }

    const queryObject = useQuery({
        queryKey: ['drivingData', searchParams.toString()],

        queryFn: async () => {
            const result = await AxiosBase.get<drivingDataResult>('/statistics/driving-data?' + searchParams.toString());

            if (applyShiftFilter) {
                result.data.driving_data = result.data.driving_data.reduce((acc, data) => {
                    if (!shiftFilter || shiftFilter.length == 0) {
                        acc.push(data);
                    } else if (shiftFilter.includes(data.shift_id)) {
                        acc.push(data);
                    }
                    return acc;
                }, [] as drivingData[]);
            }
            return result.data;
        },

        select: selector,
        refetchOnWindowFocus: false
    });

    return {queryObject};
}

export default useGetDrivingData;
