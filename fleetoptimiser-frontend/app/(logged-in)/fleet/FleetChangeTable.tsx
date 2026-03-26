import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { Card, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { FleetChangeChip } from '@/app/(logged-in)/(landing-page)/ChipFormatting';

export const FleetChangesTable = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const totals = simulationResults.vehicleDifferences.reduce(
        (acc, v) => {
            acc.current += v.currentCount;
            acc.simulation += v.simulationCount;
            acc.change += v.changeCount;
            return acc;
        },
        { current: 0, simulation: 0, change: 0 }
    );

    return (
        <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                Ændringer i flådesammensætning
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Her kan du se de ændringer, der er i den simulerede flåde sammenlignet med den nuværende flåde. Køretøjerne bliver sammenlagt, hvis de har de
                samme attributter.
            </Typography>
            <TableContainer sx={{ maxHeight: 320, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Køretøj</TableCell>
                            <TableCell className="sm:table-cell hidden">Nuværende</TableCell>
                            <TableCell>Simuleret</TableCell>
                            <TableCell>Ændring</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {simulationResults.vehicleDifferences.map((v) => (
                            <TableRow key={v.name}>
                                <TableCell>{v.name}</TableCell>
                                <TableCell className="sm:table-cell hidden">{v.currentCount}</TableCell>
                                <TableCell>{v.simulationCount}</TableCell>
                                <TableCell>{FleetChangeChip(v.changeCount)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                            <TableCell className="sm:table-cell hidden">{totals.current}</TableCell>
                            <TableCell>{totals.simulation}</TableCell>
                            <TableCell>{FleetChangeChip(totals.change)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    );
};
