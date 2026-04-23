import dayjs from 'dayjs';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { reduceDuplicateVehicles } from '@/components/DuplicateReducer';

const propellantFormat = (vehicle: Vehicle) => {
    if (vehicle.wltp_el) {
        return vehicle.wltp_el.toLocaleString() + ' Wh/km';
    } else if (vehicle.wltp_fossil) {
        return vehicle.wltp_fossil.toLocaleString() + ' km/l';
    } else {
        return 'Intet drivmiddel';
    }
};

const ComparisonFleet = ({ vehicles }: { vehicles: Vehicle[] }) => {
    const groups = reduceDuplicateVehicles(vehicles);
    return (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Biltype</TableCell>
                        <TableCell align="right">Årlig omkostning (DKK)</TableCell>
                        <TableCell align="right">Drivmiddel forbrug</TableCell>
                        <TableCell align="right">Slutleasing</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {groups.map((group) => (
                        <TableRow key={group.originalVehicles.join('-')}>
                            <TableCell>{group.count > 1 ? `${group.count} × ${group.vehicle.name}` : group.vehicle.name}</TableCell>
                            <TableCell align="right">{group.vehicle.omkostning_aar?.toLocaleString()}</TableCell>
                            <TableCell align="right">{propellantFormat(group.vehicle)}</TableCell>
                            <TableCell align="right">
                                {group.vehicle.end_leasing ? dayjs(group.vehicle.end_leasing).format('DD-MM-YYYY') : 'Ingen dato'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ComparisonFleet;
