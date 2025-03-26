import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';

type KPIKeys = 'total_saved_vehicles' | 'active_vehicles_last_month' | 'total_simulations_last_month' | 'non_fossil_share_last_month';

export type KPIs = Partial<Record<KPIKeys, number>>;

export interface SimulationHighlight {
    id: string;
    unallocated: number;
    financial_savings: number;
    co2e_savings: number;
    location_ids: number[];
    simulation_type: 'fleet' | 'goal';
    addresses: string[];
    simulation_date: string;
    fleet_change: number;
}

interface BaseView {
    address: string;
    location_id: number;
    car_count: number;
}

export interface LocationUsage extends BaseView {
    location_usage: number;
    usage_ratio: number;
    total_available_time: number;
}

interface WeekLocationActivity {
    week_name: string;
    activity: number;
    average_activity: number;
}

export interface LocationActivity extends BaseView {
    total_average_activity: number;
    total_activity: number;
    weeks: WeekLocationActivity[];
}

export function useGetLandingPageKPIs(metrics?: KPIKeys[]) {
    return useQuery(
        ['landingpagekpis', metrics],
        async () => {
            const queryString = metrics?.length ? `?${metrics.map((metric) => `metrics=${encodeURIComponent(metric)}`).join('&')}` : '';
            return await AxiosBase.get<KPIs>(`/statistics/kpis${queryString}`).then((res) => res.data);
        },
        {
            refetchOnWindowFocus: false,
        }
    );
}

export function useGetSimulationHighlights(n_simulations: number = 5) {
    return useQuery(
        ['simulationhighlights', n_simulations],
        async () => {
            const response = await AxiosBase.get<SimulationHighlight[]>(`fleet-simulation/highlights/latest?n_simulations=${n_simulations}`);
            return response.data;
        },
        {
            refetchOnWindowFocus: false,
        }
    );
}

export function useGetUsageGraphData(since_date?: Date) {
    return useQuery(
        ['usagegraphdata', since_date],
        async () => {
            const response = await AxiosBase.get<LocationUsage[]>(`/statistics/locations/usage${since_date ? `?since_date=${since_date}` : ''}`);
            return response.data;
        },
        {
            refetchOnWindowFocus: false,
        }
    );
}

export function useGetActivityGraphData(since_date?: Date) {
    return useQuery(
        ['activitygraphdata', since_date],
        async () => {
            const response = await AxiosBase.get<LocationActivity[]>(`/statistics/locations/activity${since_date ? `?since_date=${since_date}` : ''}`);
            return response.data;
        },
        {
            refetchOnWindowFocus: false,
        }
    );
}
