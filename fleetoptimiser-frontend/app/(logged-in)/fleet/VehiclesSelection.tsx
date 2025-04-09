import { IconButton, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField } from '@mui/material';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { setSimulationVehicle, setGoalSimulationVehicles } from '@/components/redux/SimulationSlice';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import { ReducedVehicleGroup } from '@/app/(logged-in)/fleet/VehiclesWidget';

type InputVehicleCountProps = {
    reducedVehicleGroup: ReducedVehicleGroup;
    restrict: boolean;
};

const InputVehicleCount = ({ reducedVehicleGroup, restrict }: InputVehicleCountProps) => {
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
                    style: { textAlign: 'center', fontSize: '0.85rem', padding: '0px', backgroundColor: '#eeeeee', borderRadius: '5px' },  // needed to access inner style
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

export const VehiclesSelectionTable = ({ manualSimulation, vehicles }: { manualSimulation: boolean; vehicles: ReducedVehicleGroup[] }) => {
    const propellantFormat = (vehicle: Vehicle) => {
        if (vehicle.wltp_el) {
            return vehicle.wltp_el.toLocaleString() + ' Wh/km';
        } else if (vehicle.wltp_fossil) {
            return vehicle.wltp_fossil.toLocaleString() + ' km/l';
        } else {
            return 'Intet drivmiddel';
        }
    };

    const totalCountCurrent = vehicles.reduce((acc, car) => acc + car.count, 0);
    const name = manualSimulation ? 'simulering' : 'optimering';
    const headerStyle = 'p-3 text-gray-500 text-sm font-bold bg-gray-50 items-center';

    return (
        <TableContainer component={Paper} className="relative my-4 shadow-none rounded-md max-h-[calc(100vh-450px)] overflow-auto">
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell className={headerStyle}>Køretøj</TableCell>
                        <TableCell className={headerStyle}>WLTP</TableCell>
                        <TableCell className={headerStyle}>Omkostning / år</TableCell>
                        <TableCell className={headerStyle}>Antal i {name}</TableCell>
                        <TableCell className={`${headerStyle} sm:table-cell hidden`}>
                            Antal i nuværende flåde
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {vehicles.map((vehicle) => {
                        const rowStyle = vehicle.extra ? 'text-blue-500' : 'text-black';

                        return (
                            <TableRow key={vehicle.vehicle.id}>
                                <TableCell className={rowStyle}>
                                    {vehicle.vehicle.make} {vehicle.vehicle.model}
                                </TableCell>
                                <TableCell className={rowStyle}>{propellantFormat(vehicle.vehicle)}</TableCell>
                                <TableCell className={rowStyle}>
                                    {vehicle.vehicle.omkostning_aar ? `${vehicle.vehicle.omkostning_aar.toLocaleString()}` : '-'}
                                </TableCell>
                                <TableCell className={rowStyle}>
                                    <InputVehicleCount reducedVehicleGroup={vehicle} restrict={false} />
                                </TableCell>
                                <TableCell className={`${rowStyle} sm:table-cell hidden`}>
                                    {vehicle.count}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} align="right" className={`sticky bottom-0 bg-white text-sm font-bold border-none`}>
                            Total
                        </TableCell>
                        <TableCell className="sticky bottom-0 bg-white text-sm font-semibold pl-16 border-none">
                            {useAppSelector((state) =>
                                state.simulation.fleetSimulationSettings.simulation_vehicles.reduce((acc, curr) => acc + curr.simulation_count, 0)
                            )}{' '}
                            / {totalCountCurrent}
                        </TableCell>
                        <TableCell className="border-none sticky bg-white bottom-0 sm:table-cell hidden"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};
