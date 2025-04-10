import { LocationsWidget } from '@/app/(logged-in)/fleet/LocationsWidget';
import { DatesWidget } from '@/app/(logged-in)/fleet/DatesWidget';
import { SimulationSettingsWidget } from '@/app/(logged-in)/fleet/SimulationSettingsWidget';
import { Alert, Button } from '@mui/material';
import { VehiclesWidget } from '@/app/(logged-in)/fleet/VehiclesWidget';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useAppSelector } from '@/components/redux/hooks';
import useSimulateFleet from '@/components/hooks/useSimulateFleet';

type FleetSimulationProps = {
    simulation: ReturnType<typeof useSimulateFleet>;
    setTab: (value: number) => void;
};

export const FleetSimulation = ({ simulation, setTab }: FleetSimulationProps) => {
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
            <LocationsWidget
                locations={
                    locationAddresses
                        ? locationAddresses.filter((location) => locations.includes(location.id)).map((location) => location.address)
                        : locations.map((loc) => `Lokation ID: ${loc}`)  // fallback to displaying id
                }
            />
            <DatesWidget startDate={startDate} endDate={endDate} manualSimulation={true} />
            <SimulationSettingsWidget manualSimulation={true} />
            {simulationDisabled && (
                <Alert className="w-64 mt-2" variant="filled" severity="error">
                    Vagtlagene på lokationerne er ikke ens. Opdater dem for at simulere.
                </Alert>
            )}
            <VehiclesWidget manualSimulation={true} />
            <div className="mt-2 w-full flex justify-end">
                <Button
                    onClick={startSimulationGoToResultTab}
                    disabled={simulationDisabled}
                    color="primary"
                    variant="contained"
                    endIcon={<ArrowForwardIosIcon />}
                >
                    Start simulering
                </Button>
            </div>
        </div>
    );
};

const areShiftsEqual = ({ shifts1, shifts2 }: { shifts1: any; shifts2: any }): boolean => {
    if (shifts1.length !== shifts2.length) {
        return false;
    }

    for (let i = 0; i < shifts1.length; i++) {
        if (shifts1[i].shift_start !== shifts2[i].shift_start || shifts1[i].shift_end !== shifts2[i].shift_end) {
            return false;
        }
    }

    return true;
};

export const compareShifts = (objects: any) => {
    if (objects === undefined || objects.length === 0) {
        return true;
    }
    const referenceShifts = objects[0].shifts;
    for (const object of objects) {
        if (!areShiftsEqual({ shifts1: object.shifts, shifts2: referenceShifts })) {
            return false;
        }
    }

    return true;
};
