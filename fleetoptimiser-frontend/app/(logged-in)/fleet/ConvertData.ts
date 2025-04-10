import {drivingBook, simulationOptions, simulationResult, VehicleUsage} from "@/components/hooks/useSimulateFleet";

export type VehicleDifference = {
    name: string;
    currentCount: number;
    simulationCount: number;
    changeCount: number;
};

export type SimulationResults = {
    unallocatedTrips: number;
    totalTrips: number;
    currentExpense: number;
    simulationExpense: number;
    currentEmission: number;
    simulationEmission: number;
    drivingBook: drivingBook[];
    simulationOptions: simulationOptions;
    vehicleDifferences: VehicleDifference[];
    vehicleUsage: VehicleUsage;
};

export function convertDataToSimulationResults(input: simulationResult): SimulationResults {
    // to streamline usage in simulationresults we convert the data
    const currentExpense = input.results.vehicle_usage.current.reduce((sum: number, item: any) => sum + Number(item['Samlet Årlig Omkostning kr'] || 0), 0);
    const simulationExpense = input.results.vehicle_usage.simulation.reduce(
        (sum: number, item: any) => sum + Number(item['Samlet Årlig Omkostning kr'] || 0),
        0
    );
    const currentEmission =
        input.results.vehicle_usage.current.reduce((sum: number, item: any) => sum + Number(item['Årlig udledning (kg CO2e)'] || 0), 0) / 1000;
    const simulationEmission =
        input.results.vehicle_usage.simulation.reduce((sum: number, item: any) => sum + Number(item['Årlig udledning (kg CO2e)'] || 0), 0) / 1000;
    const normalizeVehicleName = (name: string): string => {
        const trimmed = name.trim();
        if (trimmed === 'Benzin Medarbejderbil') return '';
        const parts = trimmed.split(' ');
        const last = parts[parts.length - 1];
        if (!isNaN(Number(last))) {
            parts.pop();
            return parts.join(' ');
        }
        return trimmed;
    };
    // Convert driving_book entries
    const drivingBook: drivingBook[] = input.driving_book.map((trip: any) => ({
        start_time: trip.start_time,
        end_time: trip.end_time,
        distance: trip.distance,
        current_vehicle_name: trip.current_vehicle_name.trim(),
        current_vehicle_id: Number(trip.current_vehicle_id),
        current_type: trip.current_type,
        simulation_vehicle_name: trip.simulation_vehicle_name.trim(),
        simulation_vehicle_id: Number(trip.simulation_vehicle_id),
        simulation_type: trip.simulation_type,
    }));

    const vehicleCounts: {
        [name: string]: { current: number; simulation: number };
    } = {};

    const currentUsage = input.results.vehicle_usage.current;
    const simulationUsage = input.results.vehicle_usage.simulation;

    currentUsage.forEach((item: any) => {
        const rawName = item['Køretøj'] || '';
        const vehicleName = normalizeVehicleName(rawName);
        if (!vehicleName) return;
        if (!vehicleCounts[vehicleName]) {
            vehicleCounts[vehicleName] = { current: 0, simulation: 0 };
        }
        vehicleCounts[vehicleName].current += 1;
    });

    simulationUsage.forEach((item: any) => {
        const rawName = item['Køretøj'] || '';
        const vehicleName = normalizeVehicleName(rawName);
        if (!vehicleName) return;
        if (!vehicleCounts[vehicleName]) {
            vehicleCounts[vehicleName] = { current: 0, simulation: 0 };
        }
        vehicleCounts[vehicleName].simulation += 1;
    });

    const vehicleDifferences: VehicleDifference[] = Object.entries(vehicleCounts).map(([name, counts]) => ({
        name,
        currentCount: counts.current,
        simulationCount: counts.simulation,
        changeCount: counts.simulation - counts.current,
    }));

    return {
        unallocatedTrips: input.unallocated,
        totalTrips: input.number_of_trips,
        currentExpense,
        simulationExpense,
        currentEmission,
        simulationEmission,
        drivingBook,
        simulationOptions: input.simulation_options,
        vehicleDifferences,
        vehicleUsage: { current: currentUsage, simulation: simulationUsage },
    };
}