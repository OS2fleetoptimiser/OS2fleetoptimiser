import { LocationsWidget } from '@/app/(logged-in)/fleet/LocationsWidget';
import { DatesWidget } from '@/app/(logged-in)/fleet/DatesWidget';
import { VehicleCountWidget } from '@/app/(logged-in)/fleet/VehicleCountWidget';
import { Alert } from '@mui/material';
import { VehiclesWidget } from '@/app/(logged-in)/fleet/VehiclesWidget';
import { useAppSelector } from '@/components/redux/hooks';
import useSimulateGoal from '@/components/hooks/useSimulateGoal';
import { compareShifts } from '@/app/(logged-in)/fleet/FleetSimulation';
import { ComparisonFleetModal } from '@/app/(logged-in)/goal/ComparisonFleetModal';

type GoalSimulationProps = {
    simulation: ReturnType<typeof useSimulateGoal>;
    setTab: (value: number) => void;
};

export const GoalSimulation = ({ simulation, setTab }: GoalSimulationProps) => {
    const locations = useAppSelector((state) => state.simulation.location_ids);
    // to be able to display the actual address
    const locationAddresses = useAppSelector((state) => state.simulation.locationIdAddresses);
    const startDate = useAppSelector((state) => state.simulation.start_date);
    const endDate = useAppSelector((state) => state.simulation.end_date);
    const locshifts = useAppSelector((state) =>
        state.simulation.settings.shift_settings.filter((shiftLocation) => state.simulation.location_ids?.includes(shiftLocation.location_id))
    ); // for asserting that the shifts of the selected locations are identical
    const simulationDisabled = !compareShifts(locshifts);
    const startSimulationGoToResultTab = () => {
        simulation.startSimulation();
        setTab(1);
    };
    return (
        <div>
            <div className="grid grid-cols-3 gap-4 mb-4 max-w-[75%]">
                <LocationsWidget
                    locations={
                        locationAddresses
                            ? locationAddresses.filter((location) => locations.includes(location.id)).map((location) => location.address)
                            : locations.map((loc) => `Lokation ID: ${loc}`)
                    }
                />
                <DatesWidget startDate={startDate} endDate={endDate} manualSimulation={false} />
                <VehicleCountWidget manualSimulation={false} />
            </div>
            {simulationDisabled && (
                <Alert className="w-64 mt-2" variant="filled" severity="error">
                    Vagtlagene på lokationerne er ikke ens. Opdater dem for at simulere.
                </Alert>
            )}
            <VehiclesWidget
                manualSimulation={false}
                onStart={startSimulationGoToResultTab}
                startDisabled={simulationDisabled}
                extraActions={<ComparisonFleetModal />}
            />
        </div>
    );
};
