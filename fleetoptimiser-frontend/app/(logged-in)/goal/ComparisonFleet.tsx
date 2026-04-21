import dayjs from 'dayjs';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

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
                    {vehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                            <TableCell>{vehicle.name}</TableCell>
                            <TableCell align="right">{vehicle.omkostning_aar?.toLocaleString()}</TableCell>
                            <TableCell align="right">{propellantFormat(vehicle)}</TableCell>
                            <TableCell align="right">
                                {vehicle.end_leasing ? dayjs(vehicle.end_leasing).format('DD-MM-YYYY') : 'Ingen dato'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ComparisonFleet;
