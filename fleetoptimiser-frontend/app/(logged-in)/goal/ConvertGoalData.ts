import { goalSimulation } from '@/components/hooks/useSimulateGoal';
import { SimulationResults, VehicleDifference } from '@/app/(logged-in)/fleet/ConvertData';
import { simulationOptions } from '@/components/hooks/useSimulateFleet';

export function convertGoalDataToSimulationResults(input: goalSimulation): { solutions: SimulationResults[] } {
    const { result } = input;
    const { solutions: goalSolutions, simulation_options } = result;

    const convertedSolutions: SimulationResults[] = goalSolutions.map((sol: any, i: number) => {
        const drivingBook =
            sol.results?.driving_book?.map((trip: any) => ({
                start_time: trip.start_time,
                end_time: trip.end_time,
                distance: trip.distance,
                current_vehicle_name: trip.current_vehicle_name.trim(),
                current_vehicle_id: Number(trip.current_vehicle_id),
                current_type: trip.current_type,
                simulation_vehicle_name: trip.simulation_vehicle_name.trim(),
                simulation_vehicle_id: Number(trip.simulation_vehicle_id),
                simulation_type: trip.simulation_type,
            })) || [];

        const vehicleUsage = sol.results?.results?.vehicle_usage || { current: [], simulation: [] };
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
        const vehicleCounts: {
            [name: string]: { current: number; simulation: number };
        } = {};
        vehicleUsage.current.forEach((item: any) => {
            const rawName = item['Køretøj'] || '';
            const vehicleName = normalizeVehicleName(rawName);
            if (!vehicleName) return;
            if (!vehicleCounts[vehicleName]) {
                vehicleCounts[vehicleName] = { current: 0, simulation: 0 };
            }
            vehicleCounts[vehicleName].current += 1;
        });

        vehicleUsage.simulation.forEach((item: any) => {
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

        const simulationVehicles =
            simulation_options.fixed_vehicles?.map((id: number) => ({
                id,
                simulation_count: 1,
            })) || [];

        const goalSimulationOptions: simulationOptions = {
            start_date: simulation_options.start_date,
            end_date: simulation_options.end_date,
            location_id: simulation_options.location_id,
            location_ids: simulation_options.location_ids,
            intelligent_allocation: simulation_options.intelligent_allocation,
            limit_km: simulation_options.limit_km,
            settings: simulation_options.settings,
            current_vehicles: simulation_options.current_vehicles,
            simulation_vehicles: simulationVehicles,
        };

        return {
            unallocatedTrips: sol.unallocated,
            totalTrips: drivingBook.length,
            currentExpense: sol.current_expense,
            simulationExpense: sol.simulation_expense,
            currentEmission: sol.current_co2e,
            simulationEmission: sol.simulation_co2e,
            drivingBook,
            simulationOptions: goalSimulationOptions,
            vehicleDifferences,
            vehicleUsage,
            solutionNumber: i,
        };
    });

    return { solutions: convertedSolutions };
}
