import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import ToolTip from '@/components/ToolTip';
import { useState, useMemo } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel } from '@mui/material';

type Order = 'asc' | 'desc';

interface VehicleUsageRow {
    Koeretoej: string;
    Allokerede_km: number;
    Aarlig_km: number;
    WLTP: string;
    Udledning_allokeret: number;
    Aarlig_udledning: number;
    Aarlig_omkostning: number;
    Aarlig_driftsomkostning: number;
    Aarlig_samfundsoekonomisk: number;
    Samlet_aarlig_omkostning: number;
}

function getNumberValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
        return value.parsedValue ?? 0;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
}

function convertUsageItemToRow(item: any): VehicleUsageRow {
    return {
        Koeretoej: item['Køretøj'] || '',
        Allokerede_km: getNumberValue(item['Allokerede km']),
        Aarlig_km: getNumberValue(item['Årlig km']),
        WLTP: typeof item['WLTP'] === 'object' ? item['WLTP'].source : item['WLTP'] || '',
        Udledning_allokeret: getNumberValue(item['Udledning for allokeret (kg CO2e)']),
        Aarlig_udledning: getNumberValue(item['Årlig udledning (kg CO2e)']),
        Aarlig_omkostning: getNumberValue(item['Årlig Omkostning kr']),
        Aarlig_driftsomkostning: getNumberValue(item['Årlig Driftsomkostning kr']),
        Aarlig_samfundsoekonomisk: getNumberValue(item['Årlig Samfundsøkonomisk Omkostning kr']),
        Samlet_aarlig_omkostning: getNumberValue(item['Samlet Årlig Omkostning kr']),
    };
}
export function getComparator<Key extends keyof any>(order: Order, orderBy: Key): (a: { [key in Key]: any }, b: { [key in Key]: any }) => number {
    return order === 'desc' ? (a, b) => descendingComparator(a, b, orderBy) : (a, b) => -descendingComparator(a, b, orderBy);
}

export function stableSort<T>(array: T[], comparator: (a: T, b: T) => number): T[] {
    const stabilizedArray = array.map((el, index) => [el, index] as [T, number]);
    stabilizedArray.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedArray.map((el) => el[0]);
}

interface VehicleUsageTableProps {
    rows: VehicleUsageRow[];
}

const headCells: { id: keyof VehicleUsageRow; label: string }[] = [
    { id: 'Koeretoej', label: 'Køretøj' },
    { id: 'Allokerede_km', label: 'Allokerede km' },
    { id: 'Aarlig_km', label: 'Årlig km' },
    { id: 'WLTP', label: 'WLTP' },
    { id: 'Udledning_allokeret', label: 'Udledning for allokeret (kg CO2e)' },
    { id: 'Aarlig_udledning', label: 'Årlig udledning (kg CO2e)' },
    { id: 'Aarlig_omkostning', label: 'Årlig Omkostning kr' },
    { id: 'Aarlig_driftsomkostning', label: 'Årlig Driftsomkostning kr' },
    { id: 'Aarlig_samfundsoekonomisk', label: 'Årlig Samfundsøkonomisk Omkostning kr' },
    { id: 'Samlet_aarlig_omkostning', label: 'Samlet Årlig Omkostning kr' },
];

export const VehicleUsageTable = ({ rows }: VehicleUsageTableProps) => {
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<keyof VehicleUsageRow>('Koeretoej');

    const handleRequestSort = (property: keyof VehicleUsageRow) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };
    function cutCharacters(str: string, cutAbove: number = 20) {
        return str.length > cutAbove ? str.slice(0, cutAbove) + '...' : str;
    }

    const sortedRows = useMemo(() => {
        return stableSort(rows, getComparator(order, orderBy));
    }, [rows, order, orderBy]);
    const headerStyle = 'text-xs font-semibold text-gray- bg-gray-50 ';
    const defaultStyle = 'py-2 border-b text-xs';
    return (
        <TableContainer className="shadow-none border-none rounded-md" component={Paper}>
            <Table stickyHeader>
                <TableHead>
                    <TableRow>
                        {headCells.map((headCell) => (
                            <TableCell className={headerStyle} key={headCell.id}>
                                <TableSortLabel
                                    active={orderBy === headCell.id}
                                    direction={orderBy === headCell.id ? order : 'asc'}
                                    onClick={() => handleRequestSort(headCell.id)}
                                >
                                    {headCell.label}
                                </TableSortLabel>
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedRows.map((row, idx) => (
                        <TableRow hover key={idx}>
                            <TableCell className={defaultStyle}>
                                <span title={row.Koeretoej}>{cutCharacters(row.Koeretoej)}</span>
                            </TableCell>
                            <TableCell className={defaultStyle}>{row.Allokerede_km}</TableCell>
                            <TableCell className={defaultStyle}>{row.Aarlig_km}</TableCell>
                            <TableCell className={defaultStyle}>{row.WLTP}</TableCell>
                            <TableCell className={defaultStyle}>{row.Udledning_allokeret.toFixed(2)}</TableCell>
                            <TableCell className={defaultStyle}>{row.Aarlig_udledning.toFixed(2)}</TableCell>
                            <TableCell className={defaultStyle}>{row.Aarlig_omkostning.toLocaleString()}</TableCell>
                            <TableCell className={defaultStyle}>{row.Aarlig_driftsomkostning.toLocaleString()}</TableCell>
                            <TableCell className={defaultStyle}>{row.Aarlig_samfundsoekonomisk.toLocaleString()}</TableCell>
                            <TableCell className={defaultStyle}>{row.Samlet_aarlig_omkostning.toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export const VehicleResults = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const simulatedVehicleUsage = useMemo(() => {
        return simulationResults.vehicleUsage.simulation.map((item) => convertUsageItemToRow(item));
    }, [simulationResults.vehicleUsage.simulation]);
    const currentVehicleUsage = useMemo(() => {
        return simulationResults.vehicleUsage.current.map((item) => convertUsageItemToRow(item));
    }, [simulationResults.vehicleUsage.current]);

    return (
        <div className="mt-4 p-4 border border-gray-100 rounded-md shadow-sm">
            <span className="font-bold text-sm">Detaljer om køretøjsforbrug i simulerede og nuværende flåde</span>
            <ToolTip>
                Se hvilke effekter det har på din køreplan og flåde ved at simulere med en ny flådesammensætning. Du kan se de aktivt allokerede km på hvert
                køretøj og hvad det resulterer i over et år. Udgifterne forbundet med køretøjet, både omkostning - og udledningsmæssigt forbrug bliver også
                vist.
            </ToolTip>
            <div className="mt-2 mb-6 space-y-2">
                <span className="font-semibold text-sm">Simuleret forbrug</span>
                <VehicleUsageTable rows={simulatedVehicleUsage} />
            </div>
            <div className="space-y-2">
                <span className="font-semibold text-sm">Nuværende forbrug</span>
                <VehicleUsageTable rows={currentVehicleUsage} />
            </div>
        </div>
    );
};
