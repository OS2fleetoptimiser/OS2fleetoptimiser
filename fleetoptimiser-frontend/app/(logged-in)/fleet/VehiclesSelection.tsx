import { Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow } from '@mui/material';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { useAppSelector } from '@/components/redux/hooks';
import { ReducedVehicleGroup } from '@/app/(logged-in)/fleet/VehiclesWidget';
import { InputVehicleCount } from './InputVehicleCount';
import ToolTip from '@/components/ToolTip';

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
    const automaticToolText =
        'Hvis du fjerner køretøjer, kan algoritmen erstatte dem med andre testkøretøjer for at finde det bedste mix. Hvis du beholder dem, vil algoritmen forsøge at reducere antallet ved overkapacitet. Dvs. den vil ikke forsøge at udskifte dem med andre testkøretøjer.';
    return (
        <TableContainer component={Paper} className="relative my-4 shadow-none rounded-md max-h-[calc(100vh-450px)] overflow-auto">
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell className={headerStyle}>Køretøj</TableCell>
                        <TableCell className={headerStyle}>WLTP</TableCell>
                        <TableCell className={headerStyle}>Omkostning / år</TableCell>
                        <TableCell className={headerStyle}>
                            Antal i {name}
                            {!manualSimulation ? <ToolTip>{automaticToolText}</ToolTip> : ''}
                        </TableCell>
                        <TableCell className={`${headerStyle} xl:table-cell hidden`}>Antal i nuværende flåde</TableCell>
                        {!manualSimulation && <TableCell className={`${headerStyle} xl:table-cell hidden`}>Slut leasing</TableCell>}
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
                                    <InputVehicleCount reducedVehicleGroup={vehicle} restrict={!manualSimulation} />
                                </TableCell>
                                <TableCell className={`${rowStyle} xl:table-cell hidden`}>{vehicle.count}</TableCell>
                                {!manualSimulation && (
                                    <TableCell className={`${rowStyle} xl:table-cell hidden`}>
                                        {vehicle.vehicle.end_leasing ? new Date(vehicle.vehicle.end_leasing).toLocaleDateString() : 'Ejet'}
                                    </TableCell>
                                )}
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
                        <TableCell colSpan={manualSimulation ? 1 : 2} className="border-none sticky bg-white bottom-0 xl:table-cell hidden"></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};
