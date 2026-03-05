import { useQuery } from "@tanstack/react-query";
import AxiosBase from "@/components/AxiosBase";
import dayjs from 'dayjs';
import {useState} from "react";

interface AllowedStartAddition {
    id: number | null;
    latitude: number;
    longitude: number;
    allowed_start_id: number | null;
    addition_date: string | null;
}

export interface AllowedStart {
    id: number | null;
    address: string;
    latitude: number | null; // nullable if parent is deleted
    longitude: number | null;
    additional_starts: AllowedStartAddition[] | null;
    car_count: number | null;
    addition_date: string | null;
}

export interface ExtendedLocationInformation extends AllowedStart {
    precision: number;
    roundtrip_km: number;
    km: number;
}

interface AllowedStartPrecision {
    id: number;
    precision: number;
    roundtrip_km: number;
    km: number;

}

interface PrecisionTestResults extends AllowedStartPrecision {
    test_settings: {
        location: number,
        test_specific_start: AllowedStart,
        start_date: string
    }
}

type PrecisionTest = {
    id: string;
    status: string;
    progress?: { progress: number }
    result?: PrecisionTestResults
}

export const useGetLocationPrecision = (startDate: Date) => {
    const formattedDate = dayjs(startDate).format('YYYY-MM-DD');

    return useQuery({
        queryKey: ['location precision', formattedDate],

        queryFn: () => AxiosBase.get<ExtendedLocationInformation[]>('locations/precision', {
            params: { start_date: formattedDate},
        }).then(res => res.data),

        refetchOnWindowFocus: false
    });
};

export const useGetSingleLocationPrecision = (startDate: Date, locationId?: number) => {
    const formattedDate = dayjs(startDate).format('YYYY-MM-DD');
    return useQuery({
        queryKey: ['single location precision', formattedDate],

        queryFn: () => AxiosBase.get<ExtendedLocationInformation[]>('locations/precision', {
            params: { start_date: formattedDate, locations: locationId },
        }).then(res => res.data.filter(data => data.id === locationId)[0]),

        refetchOnWindowFocus: false,
        enabled: !!locationId
    });
};

export const patchLocation = async (allowedStart?: AllowedStart) => {
    if (!allowedStart){
        return
    }
    const allowedStartCopy = { ...allowedStart };
    if (allowedStartCopy.additional_starts) {
        // remove the ids of additions to force deletion and creation of new
        allowedStartCopy.additional_starts = allowedStartCopy.additional_starts.map(({ id, ...rest }) => ({
            ...rest,
            id: null
        }));
    }

    const response = await AxiosBase.patch('locations/location', allowedStartCopy);
    return response.data;
}


export const createLocation = async (allowedStart: AllowedStart) => {
    const allowedStartCopy = { ...allowedStart };
    if (allowedStartCopy.additional_starts) {
        // remove the ids of additions to force deletion and creation of new
        allowedStartCopy.additional_starts = allowedStartCopy.additional_starts.map(({ id, ...rest }) => ({
            ...rest,
            id: null
        }));
    }
    const response = await AxiosBase.post('locations/location', allowedStartCopy);
    return response.data;
}


export const ChangeLocationAddress = async (locationId: number, address: string) => {
    const response = await AxiosBase.patch('locations/location/name',
        {
            "location_id": locationId,
            "address": address
        }
        )
    return response.data
}


export const useTestLocationPrecision = (initialDataId?: string, startDate?: Date, locationId?: number, testSpecificStart?: AllowedStart) => {
    const testPrecisionJob = useQuery({
        queryKey: ['test precision', testSpecificStart],

        queryFn: async () => {
            const result = await AxiosBase.post<PrecisionTest>('locations/precision-test', {location: locationId, start_date: startDate, test_specific_start: testSpecificStart});
            return result.data
        },

        enabled: false
    });
    const [running, setRunning] = useState(false);
    const [cancelled, setCancel] = useState(false);

    const stopThePrecisionTest = () => {
        setCancel(true);
        const sendStopSignal = async (id: any) => {
            try {
                const response = await AxiosBase.delete(`locations/precision-test/${id}`);
                console.error('precision test deleted', response);
            } catch (error) {
                console.error('Error deleting precision test', error);
            }
        };
        sendStopSignal(testPrecisionJob.data?.id ?? initialDataId);
        setRunning(false);
    };

    const precisionTestResult = useQuery({
        queryKey: ['precision test result', testPrecisionJob.data?.id ?? initialDataId],

        queryFn: async () => {
            const result = await AxiosBase.get<PrecisionTest>(`locations/precision-test/${ testPrecisionJob.data?.id ?? initialDataId}`);
            return result.data;
        },

        refetchInterval: (query) => {
            const data = query.state.data;
            return !data ||
                data.status === 'PENDING' ||
                data.status === 'STARTED' ||
                data.status === 'RETRY' ||
                data.status === 'PROGRESS' ||
                data.status === 'RECEIVED'
                    ? 500
                    : false;
        },

        enabled: (!!initialDataId || !!testPrecisionJob.data) && !cancelled
    });
    return {
        startPrecisionTest: () => {
            setCancel(false);
            setRunning(true);
            return testPrecisionJob.refetch();
        },
        query: precisionTestResult,
        cancelled: cancelled,
        running: running,
        stopPrecisionTest: () => stopThePrecisionTest(),
    }
}
