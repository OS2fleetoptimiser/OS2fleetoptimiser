import { useState, useMemo } from 'react';
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    InputAdornment,
    IconButton,
    Typography,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { getComparator, stableSort } from '@/app/(logged-in)/fleet/VehicleResultsTable';
import {drivingBook} from "@/components/hooks/useSimulateFleet";

type DrivingBookTableProps = {
    data: drivingBook[]
};

type Order = 'asc' | 'desc';

const headCells: { id: keyof Pick<drivingBook, 'start_time' | 'end_time' | 'distance' | 'current_vehicle_name' | 'simulation_vehicle_name'>; label: string }[] =
    [
        { id: 'start_time', label: 'Start Tidspunkt' },
        { id: 'end_time', label: 'Slut Tidspunkt' },
        { id: 'distance', label: 'Distance' },
        { id: 'current_vehicle_name', label: 'Nuværende Køretøj' },
        { id: 'simulation_vehicle_name', label: 'Simuleret Køretøj' },
    ];

export const DrivingBookTable = ({ data }: DrivingBookTableProps) => {
    const [order, setOrder] = useState<Order>('asc');
    const [orderBy, setOrderBy] = useState<keyof drivingBook>('start_time');
    const [filterText, setFilterText] = useState<string>('');

    const handleRequestSort = (property: keyof drivingBook) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredData = useMemo(() => {
        if (!filterText) return data;
        return data.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(filterText.toLowerCase())));
    }, [data, filterText]);

    const sortedData = useMemo(() => {
        return stableSort(filteredData, getComparator(order, orderBy));
    }, [filteredData, order, orderBy]);

    return (
        <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                Køreplan for simulering
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Se hvordan køreplanen ser ud, med den simulerede flåde overfor hvordan turene er kørt i virkeligheden (nuværende).
                Ikke allokerede ture vil have "Ikke allokeret" i kolonne "Simuleret køretøj". Samme køretøj kan optræde flere gange,
                hvis de har samme attributter men forskellig leasing-dato eller omkostning.
            </Typography>
            <TextField
                size="small"
                placeholder="Filtrér i køreplanen..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                sx={{ mb: 1.5 }}
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: filterText ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setFilterText('')}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    },
                }}
            />
            <TableContainer sx={{ maxHeight: 'calc(100vh - 420px)', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {headCells.map((headCell) => (
                                <TableCell key={headCell.id}>
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
                        {sortedData.map((row, index) => (
                            <TableRow hover key={index}>
                                <TableCell>{row.start_time}</TableCell>
                                <TableCell>{row.end_time}</TableCell>
                                <TableCell>{row.distance.toLocaleString()}</TableCell>
                                <TableCell>{row.current_vehicle_name}</TableCell>
                                <TableCell>{row.simulation_vehicle_name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    );
};
