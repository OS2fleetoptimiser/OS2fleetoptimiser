import CommuteIcon from '@mui/icons-material/Commute';
import ExtraVehicleModal from '@/app/(logged-in)/fleet/ExtraVehiclesModal';
import { useMemo } from 'react';
import { VehiclesSelectionTable } from '@/app/(logged-in)/fleet/VehiclesSelection';
import { useAppSelector } from '@/components/redux/hooks';
import { duplicateVehicle, reduceDuplicateVehicles } from '@/components/DuplicateReducer';
import { Vehicle } from '@/components/hooks/useGetVehicles';

export type ReducedVehicleGroup = {
    vehicle: Vehicle;
    count: number;
    groupIds: number[];
    extra: boolean;
};

export const VehiclesWidget = ({ manualSimulation }: { manualSimulation: boolean }) => {
    const currentGroups: duplicateVehicle[] = useAppSelector((state) => reduceDuplicateVehicles(state.simulation.selectedVehicles));
    const extraGroups: duplicateVehicle[] = useAppSelector((state) => reduceDuplicateVehicles(state.simulation.fleetSimulationSettings.extraVehicles));
    const fleet: ReducedVehicleGroup[] = useMemo(() => {
        return [
            ...currentGroups.map((group) => ({
                vehicle: group.vehicle,
                extra: false,
                count: group.count,
                groupIds: group.originalVehicles, // used to update goalsimulationsettings.fixed
            })),
            ...extraGroups.map((group) => ({
                vehicle: group.vehicle,
                extra: true,
                count: 0,
                groupIds: [],
            })),
        ];
    }, [currentGroups, extraGroups]);

    return (
        <div className="mt-6 w-auto border border-gray-200 rounded-md shadow-sm p-2 px-4">
            <div className="flex justify-between">
                <div className="flex flex-row items-center space-x-2">
                    <CommuteIcon className="text-blue-500" fontSize="small" />
                    <span className="text-md font-bold">Vælg køretøjer i simulering</span>
                </div>
                <ExtraVehicleModal buttonAppearance={true} />
            </div>
            <VehiclesSelectionTable manualSimulation={manualSimulation} vehicles={fleet} />
        </div>
    );
};
