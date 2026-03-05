import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import AxiosBase from '../AxiosBase';

interface inputParameters {
    start: Dayjs | null;
    end: Dayjs | null;
    locations?: number[];
    forvaltninger?: string[];
}

type summedStatistics = {
    first_date: string;
    last_date: string;
    total_driven: number;
    total_emission: number;
    share_carbon_neutral: number;
};

export function useGetSummedStatistics({ start, end, locations, forvaltninger }: inputParameters) {
    const searchParams = new URLSearchParams();
    if (start) searchParams.append('start_date', start.format('YYYY-MM-DD'));
    if (end) searchParams.append('end_date', end.format('YYYY-MM-DD'));

    if (locations) {
        for (const location of locations) {
            searchParams.append('locations', location.toString());
        }
    }

    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    return useQuery({
        queryKey: ['summed stats', searchParams.toString()],

        queryFn: async () => {
            const result = await AxiosBase.get<summedStatistics>(`/statistics/sum?${searchParams.toString()}`);
            return result.data;
        },

        refetchOnWindowFocus: false
    });
}
