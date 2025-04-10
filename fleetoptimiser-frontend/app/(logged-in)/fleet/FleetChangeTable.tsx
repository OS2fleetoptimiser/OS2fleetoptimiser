import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow } from '@mui/material';
import ToolTip from '@/components/ToolTip';

export const FleetChangesTable = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    function cutCharacters(str: string, cutAbove: number = 20) {
        return str.length > cutAbove ? str.slice(0, cutAbove) + '...' : str;
    }

    const totals = simulationResults.vehicleDifferences.reduce(
        (acc, v) => {
            acc.current += v.currentCount;
            acc.simulation += v.simulationCount;
            acc.change += v.changeCount;
            return acc;
        },
        { current: 0, simulation: 0, change: 0 }
    );
    const defaultStyle = 'py-2 border-b text-sm';
    const headerStyle = 'text-sm font-semibold text-gray-600';

    return (
        <div className="bg-white p-4 pt-2 rounded-md shadow-sm border border-gray-100 w-full h-full overflow-y-auto">
            <div className="flex items-center">
                <span className="text-sm font-semibold">Ændringer i flådesammensætning</span>
                <ToolTip>
                    Her kan du se de ændringer der er i den simuleret flåde sammenlignet med den nuværende flåde. Køretøjerne bliver sammenlagt, hvis de har de
                    samme attributter.
                </ToolTip>
            </div>
            <TableContainer component={Paper} className="relative shadow-none h-auto max-h-[320px] overflow-auto">
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell className={headerStyle}>Køretøj</TableCell>
                            <TableCell className={`${headerStyle} sm:table-cell hidden`}>
                                Nuværende
                            </TableCell>
                            <TableCell className={headerStyle}>
                                Simuleret
                            </TableCell>
                            <TableCell className={headerStyle}>
                                Ændring
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {simulationResults.vehicleDifferences.map((v) => {
                            const sign = v.changeCount > 0 ? '+' : '';
                            return (
                                <TableRow key={v.name}>
                                    <TableCell className={defaultStyle}>
                                        <span title={v.name}>{cutCharacters(v.name)}</span>
                                    </TableCell>
                                    <TableCell className={`${defaultStyle} sm:table-cell hidden`}>
                                        {v.currentCount}
                                    </TableCell>
                                    <TableCell className={defaultStyle}>
                                        {v.simulationCount}
                                    </TableCell>
                                    <TableCell className={defaultStyle}>
                                        {sign}
                                        {v.changeCount}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={1} className="sticky bottom-0 border-b-0 bg-white text-sm font-bold">
                                Total
                            </TableCell>
                            <TableCell
                                className="sticky bottom-0 border-b-0 bg-white text-sm  sm:table-cell hidden"
                            >
                                {totals.current}
                            </TableCell>
                            <TableCell className="sticky bottom-0 border-b-0 bg-white text-sm">
                                {totals.simulation}
                            </TableCell>
                            <TableCell className="sticky bottom-0 border-b-0 bg-white text-sm font-semibold">
                                {totals.change > 0 ? '+' : ''}
                                {totals.change}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </TableContainer>
        </div>
    );
};
