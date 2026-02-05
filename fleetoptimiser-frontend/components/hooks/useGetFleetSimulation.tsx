import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import { simulation } from './useSimulateFleet';

const useGetFleetSimulation = (simulationId: string) => {
    return useQuery({
        queryKey: ['simulation result', simulationId],

        queryFn: () =>
            AxiosBase.get<simulation>(`/fleet-simulation/simulation/${simulationId}`).then((res) => res.data),

        refetchOnWindowFocus: false,
        staleTime: Infinity
    });
};

export default useGetFleetSimulation;
