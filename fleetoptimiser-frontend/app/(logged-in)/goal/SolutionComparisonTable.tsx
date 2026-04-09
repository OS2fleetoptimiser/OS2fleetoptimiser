import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Typography,
} from '@mui/material'
import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData'
import { FleetChangeChip, PlusMinusChip, UnallocatedChip } from '@/app/(logged-in)/(landing-page)/ChipFormatting'

export function SolutionComparisonTable({ solutions }: { solutions: SimulationResults[] }) {
    return (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Løsning</TableCell>
                        <TableCell align="right">Ændring i køretøjer</TableCell>
                        <TableCell align="right">Besparelse</TableCell>
                        <TableCell align="right">Reduktion</TableCell>
                        <TableCell align="right">Ikke tildelte ture</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {solutions.map((sol, i) => {
                        const vehDifference = sol.vehicleDifferences.reduce((sum: number, vd) => sum + vd.changeCount, 0)
                        const costDifference = sol.currentExpense - sol.simulationExpense
                        const emissionDifference = sol.currentEmission - sol.simulationEmission

                        return (
                            <TableRow key={i}>
                                <TableCell>
                                    <Typography variant="subtitle2">Løsning {i + 1}</Typography>
                                </TableCell>
                                <TableCell align="right">{FleetChangeChip(vehDifference)}</TableCell>
                                <TableCell align="right">{PlusMinusChip(costDifference, 'DKK/år')}</TableCell>
                                <TableCell align="right">{PlusMinusChip(emissionDifference, 'Ton CO2e/år')}</TableCell>
                                <TableCell align="right">{UnallocatedChip(sol.unallocatedTrips)}</TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
