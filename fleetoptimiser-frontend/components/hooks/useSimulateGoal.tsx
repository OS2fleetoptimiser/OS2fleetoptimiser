import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import AxiosBase from '../AxiosBase';
import { useAppSelector } from '../redux/hooks';
import { settings } from './useGetSettings';
import { useState } from 'react';
import { drivingBook, ExtendedSimResults } from "@/components/hooks/useSimulateFleet";

type ExtendedGoalSimResults = {
    results: ExtendedSimResults;
    driving_book: drivingBook[];
}

export type goalSolution = {
    current_expense: number;
    simulation_expense: number;
    current_co2e: number;
    simulation_co2e: number;
    unallocated: number;
    vehicles: {
        id: number;
        count: number;
        name: string;
        omkostning_aar: number;
        emission: string;
        count_difference?: number;
    }[];
    results: ExtendedGoalSimResults;
};

type goalSimulationOptions = {
    start_date: string;
    end_date: string;
    location_id: number;
    location_ids?: number[];
    intelligent_allocation: boolean;
    limit_km: boolean;
    extra_expense: number;
    co2e_saving: number;
    prioritisation: number;
    settings: settings;
    current_vehicles: number[];
    fixed_vehicles: number[];
    test_vehicles: number[];
};

export type goalSimulation = {
    id: string;
    status: string;
    progress: { progress: number, task_message?: string; };
    result: {
        number_of_trips: number;
        solutions: goalSolution[];
        simulation_options: goalSimulationOptions;
        message?: string;
    };
};

function useSimulateGoal(initialDataId?: string) {
    const goalSimulationSettings = useAppSelector((state) => {
        const endDate = new Date(state.simulation.end_date);
        endDate.setDate(endDate.getDate() + 1);

        return {
            start_date: state.simulation.start_date,
            end_date: endDate.toISOString().split('T')[0], // Convert Date object to desired format "YYYY-MM-DD"
            location_id: state.simulation.location_id,
            location_ids: state.simulation.location_ids,
            intelligent_allocation: state.simulation.intelligent_allocation,
            limit_km: state.simulation.limit_km,
            current_vehicles: state.simulation.selectedVehicles.map((c) => c.id),
            fixed_vehicles: state.simulation.goalSimulationSettings.fixed_vehicles,
            extra_expenses: state.simulation.goalSimulationSettings.extraExpense ?? 0,
            co2e_saving: state.simulation.goalSimulationSettings.CO2eSavings ?? 0,
            prioritisation: state.simulation.goalSimulationSettings.expenseEmissionPrioritisation,
            test_vehicles: state.simulation.goalSimulationSettings.testVehicles,
            settings: state.simulation.settings,
        };
    });

    const simulationJob = useQuery({
        queryKey: ['goal'],

        queryFn: async () => {
            const result = await AxiosBase.post<goalSimulation>('/goal-simulation/simulation', goalSimulationSettings);
            return result.data;
        },

        enabled: false
    });
    const [running, setRunning] = useState(false);
    const [cancelled, setCancel] = useState(false);

    const stopTheSimulation = () => {
        setCancel(true);
        const sendStopSignal = async (id: any) => {
            try {
                const response = await AxiosBase.delete(`/goal-simulation/simulation/${id}`);
                console.error('simulation deleted', response);
            } catch (error) {
                console.error('Error deleting simulation', error);
            }
        };
        sendStopSignal(simulationJob.data?.id ?? initialDataId);
        setRunning(false);
    };

    const simulationResult = useQuery({
        queryKey: ['goal result', simulationJob.data?.id ?? initialDataId],

        queryFn: async () => {
            const result = await AxiosBase.get<goalSimulation>(`/goal-simulation/simulation/${simulationJob.data?.id ?? initialDataId}`);
            return result.data;
        },

        refetchInterval: (query) => {
            const data = query.state.data;
            return !data ||
                data.status === 'PENDING' ||
                data.status === 'STARTED' ||
                data.status === 'RETRY' ||
                data.status === 'PROGRESS' ||
                data.status === 'RECIEVED'
                    ? 500
                    : false;
        },

        enabled: (!!initialDataId || !!simulationJob.data) && !cancelled
    });

    return {
        startSimulation: () => {
            setCancel(false);
            setRunning(true);
            return simulationJob.refetch();
        },
        query: simulationResult,
        cancelled: cancelled,
        running: running,
        stopSimulation: () => stopTheSimulation(),
    };
}

export default useSimulateGoal;
