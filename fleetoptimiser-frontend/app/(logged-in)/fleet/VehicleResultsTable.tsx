import { useMemo, useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel } from '@mui/material';
import { VehicleUsageRow } from '@/app/(logged-in)/fleet/VehicleResults';

type Order = 'asc' | 'desc';

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
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
