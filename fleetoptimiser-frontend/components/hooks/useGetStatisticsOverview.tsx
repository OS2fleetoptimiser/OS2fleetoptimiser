import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import AxiosBase from '../AxiosBase';

type dashboardCategories = 'emission' | 'driven' | 'share';

type timeSeriesData = {
    data: {
        x: string;
        y: number;
    }[];
};

interface inputParameters<T> {
    startPeriod: Dayjs | null;
    endPeriod: Dayjs | null;
    dashboard: dashboardCategories;
    locationIds?: number[];
    forvaltninger?: string[];
    selector?: (data: timeSeriesData) => T;
}

function useGetStatisticsOverview<T = timeSeriesData>({ startPeriod, endPeriod, dashboard, locationIds, forvaltninger, selector }: inputParameters<T>) {
    const searchParams = new URLSearchParams();
    searchParams.append('view', dashboard);
    if (startPeriod) searchParams.append('start_date', startPeriod?.format('YYYY-MM-DD'));
    if (endPeriod) searchParams.append('end_date', endPeriod?.add(1, 'day').format('YYYY-MM-DD'));
    if (locationIds) {
        for (const locationId of locationIds) {
            searchParams.append('locations', locationId.toString());
        }
    }
    if (forvaltninger) {
        for (const forvaltning of forvaltninger) {
            searchParams.append('forvaltninger', forvaltning);
        }
    }

    return useQuery({
        queryKey: ['statoverview', dashboard, searchParams.toString()],

        queryFn: async () => {
            const result = await AxiosBase.get<timeSeriesData>(`/statistics/overview?${searchParams.toString()}`);
            return result.data;
        },

        select: selector,
        refetchOnWindowFocus: false
    });
}

export default useGetStatisticsOverview;
