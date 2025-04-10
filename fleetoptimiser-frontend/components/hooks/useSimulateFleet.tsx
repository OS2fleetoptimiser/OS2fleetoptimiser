import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import { useAppSelector } from '../redux/hooks';
import { settings } from './useGetSettings';

export type drivingBook = {
    start_time: string;
    end_time: string;
    distance: number;
    current_vehicle_name: string;
    current_vehicle_id: number;
    current_type: number;
    simulation_vehicle_name: number;
    simulation_vehicle_id: number;
    simulation_type: number;
};

export type simulationOptions = {
    start_date: string;
    end_date: string;
    location_id: number;
    location_ids?: number[];
    intelligent_allocation: boolean;
    limit_km: boolean;
    settings: settings;
    current_vehicles: number[];
    simulation_vehicles: {
        id: number;
        simulation_count: number;
    }[];
};

type VehicleResult = {
    "Køretøj": string;
    "Allokerede km": number;
    "Årlig km": number;
    "WLTP": number | string;
    "Udledning for allokeret (kg CO2e)": number;
    "Årlig udledning (kg CO2e)": number;
    "Årlig Omkostning kr": number;
    "Årlig Samfundsøkonomisk Omkostning kr": number;
    "Samlet Årlig Omkostning": number;
}

type VehicleDistribution = {
    name: string;
    x: number[];
    y: number[];
}

type UnallocatedDistribution = {
    date: string;
    "Antal ikke allokeret": number;
}


export type VehicleUsage = {
    current: VehicleResult[];
    simulation: VehicleResult[];
};

type ExtendedSimResults = {
    current_vehicle_distribution: VehicleDistribution[];
    simulation_vehicle_distribution: VehicleDistribution[];
    unallocated_pr_day: UnallocatedDistribution[];
    vehicle_usage: VehicleUsage;
}

export type simulationResult = {
    number_of_trips: number;
    unallocated: number;
    financial_savings: number;
    co2e_savings: number;
    driving_book: drivingBook[];
    simulation_options: simulationOptions;
    results: ExtendedSimResults;
};

export type simulation = {
    id: string;
    status: string;
    result: simulationResult;
};

function useSimulateFleet(initialDataId?: string) {
    const input = useAppSelector((state) => {
        const endDate = new Date(state.simulation.end_date);
        endDate.setDate(endDate.getDate() + 1);

        return {
            start_date: state.simulation.start_date,
            end_date: endDate.toISOString().split('T')[0], // Convert Date object to desired format "YYYY-MM-DD"
            location_id: state.simulation.location_id,
            location_ids: state.simulation.location_ids,
            intelligent_allocation: state.simulation.intelligent_allocation,
            limit_km: state.simulation.limit_km,
            simulation_vehicles: state.simulation.fleetSimulationSettings.simulation_vehicles,
            current_vehicles: state.simulation.selectedVehicles.map((c) => c.id),
            settings: state.simulation.settings,
        };
    });

    const simulationJob = useQuery(
        ['simulate'],
        async () => {
            const result = await AxiosBase.post<simulation>('/fleet-simulation/simulation', input);
            return result.data;
        },
        {
            enabled: false,
        }
    );

    const simulationResult = useQuery(
        ['simulation result', simulationJob.data?.id ?? initialDataId],
        async () => {
            const result = await AxiosBase.get<simulation>(`/fleet-simulation/simulation/${simulationJob.data?.id ?? initialDataId}`);
            return result.data;
        },
        {
            enabled: !!initialDataId || !!simulationJob.data,
            refetchInterval: (data) =>
                !data ||
                data.status === 'PENDING' ||
                data.status === 'STARTED' ||
                data.status === 'RETRY' ||
                data.status === 'PROGRESS' ||
                data.status === 'RECIEVED'
                    ? 500
                    : false,
        }
    );

    return {
        startSimulation: simulationJob.refetch,
        query: simulationResult,
    };
}

export default useSimulateFleet;
