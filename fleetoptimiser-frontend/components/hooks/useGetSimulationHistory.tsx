import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import dayjs from 'dayjs';

type simulatioHistory = {
    id: string;
    start_date: string;
    end_date: string;
    location: string;
    locations?: string;
    simulation_date: string;
};

const dateSort = (a: simulatioHistory, b: simulatioHistory) => dayjs(b.simulation_date).unix() - dayjs(a.simulation_date).unix();

export const useGetFleetSimulationHistory = () => {
    return useQuery({
        queryKey: ['fleet history'],
        queryFn: () => AxiosBase.get<simulatioHistory[]>('fleet-simulation/simulation-history').then((res) => res.data),
        select: (data) => data.sort(dateSort)
    });
};

export const useGetGoalSimulationHistory = () => {
    return useQuery({
        queryKey: ['goal history'],
        queryFn: () => AxiosBase.get<simulatioHistory[]>('goal-simulation/simulation-history').then((res) => res.data),
        select: (data) => data.sort(dateSort)
    });
};
