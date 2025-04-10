import { ReducedVehicleGroup } from '@/app/(logged-in)/fleet/VehiclesWidget';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { setGoalSimulationVehicles, setSimulationVehicle } from '@/components/redux/SimulationSlice';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';

type InputVehicleCountProps = {
    reducedVehicleGroup: ReducedVehicleGroup;
    restrict: boolean;
};

export const InputVehicleCount = ({ reducedVehicleGroup, restrict }: InputVehicleCountProps) => {
    const { vehicle, count: availableCount, groupIds } = reducedVehicleGroup;

    const dispatch = useAppDispatch();
    const simulationCount = useAppSelector(
        (state) => state.simulation.fleetSimulationSettings.simulation_vehicles.find((c) => c.id === vehicle.id)?.simulation_count ?? 0
    );

    const allGoalSimulationVehicles = useAppSelector((state) => state.simulation.goalSimulationSettings.fixed_vehicles);

    const updateCount = (newCount: number) => {
        if (restrict) {
            // if restrict = goal simulation, don't allow count to exceed availableCount
            if (availableCount === 0) {
                newCount = 0;
            } else if (newCount > availableCount) {
                return;
            }
        }

        let updatedFixedVehicles = allGoalSimulationVehicles.filter((vid) => !groupIds.includes(vid));
        const idsToAdd = groupIds.slice(0, newCount);
        updatedFixedVehicles = updatedFixedVehicles.concat(idsToAdd);

        // update both manual and automatic sim dependent states
        dispatch(setGoalSimulationVehicles(updatedFixedVehicles));
        dispatch(setSimulationVehicle({ id: vehicle.id, simulation_count: newCount }));
    };

    const handleIncrement = () => {
        if (!restrict || simulationCount < availableCount) {
            updateCount(simulationCount + 1);
        }
    };

    const handleDecrement = () => {
        if (simulationCount > 0) {
            updateCount(simulationCount - 1);
        }
    };

    const handleChange = (val: string) => {
        const newCount = +val;
        if (Number.isNaN(newCount)) return;
        if (restrict && newCount > availableCount) return;
        updateCount(newCount);
    };

    // if restrict = goal sim don't allow test/extra vehicles more than 0
    const adjustmentDisabled = restrict && availableCount === 0;

    return (
        <div className="flex flex-row items-center ">
            <TextField
                disabled={adjustmentDisabled}
                type="number"
                variant="outlined"
                size="small"
                value={simulationCount}
                onChange={(e) => handleChange(e.target.value)}
                inputProps={{
                    min: 0,
                    max: restrict ? availableCount : 9999,
                    style: { textAlign: 'center', fontSize: '0.85rem', padding: '0px', backgroundColor: '#eeeeee', borderRadius: '5px' }, // needed to access inner style
                }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment className="hidden sm:flex" position="start">
                            <IconButton disabled={adjustmentDisabled} onClick={handleDecrement} edge="start">
                                <RemoveIcon className="bg-gray-100 rounded-2xl p-1" />
                            </IconButton>
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment className="hidden sm:flex" position="end">
                            <IconButton disabled={adjustmentDisabled} onClick={handleIncrement} edge="end">
                                <AddIcon className="bg-gray-100 rounded-2xl p-1" />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                sx={{
                    '.MuiOutlinedInput-root': {
                        paddingRight: '0px',
                        paddingLeft: '0px',
                        fieldset: {
                            borderRadius: '2px',
                            borderWidth: '0px',
                        },
                    },
                    '& input[type=number]': {
                        '-moz-appearance': 'textfield',
                    },
                    '& input[type=number]::-webkit-outer-spin-button': {
                        '-webkit-appearance': 'none',
                        margin: 0,
                    },
                    '& input[type=number]::-webkit-inner-spin-button': {
                        '-webkit-appearance': 'none',
                        margin: 0,
                    },
                }}
            />
        </div>
    );
};
