import { useState, useMemo } from 'react';
import {
    Paper,
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
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import ToolTip from '@/components/ToolTip';
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

    // global filtering: filter across all fields
    const filteredData = useMemo(() => {
        if (!filterText) return data;
        return data.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(filterText.toLowerCase())));
    }, [data, filterText]);

    const sortedData = useMemo(() => {
        return stableSort(filteredData, getComparator(order, orderBy));
    }, [filteredData, order, orderBy]);
    const headerStyle = 'text-sm font-semibold text-gray-600 bg-gray-50';
    const defaultStyle = 'py-2 border-b text-sm';

    return (
        <div className="mt-4 p-4 border border-gray-100 rounded-md shadow-sm">
            <span className="font-bold text-sm">Køreplan for simulering</span>
            <ToolTip>
                Se hvordan køreplanen ser ud, med den simulerede flåde overfor hvordan turene er kørt i virkligheden (nuværende). Filtrér eller sorter direkte
                på kolonnerne. Ikke allokerede ture vil have &quot;Ikke allokeret&quot; i kolonne &quot;Simuleret køretøj&quot;. Hver opmærksom på at samme
                køretøj kan optræde flere gange, hvis de har samme attributter men forskellig leasing-dato eller omkostning.
            </ToolTip>
            <div className="mb-2">
                <TextField
                    placeholder="Filtrér i køreplanen"
                    variant="standard"
                    size="small"
                    className="my-1 bg-[#F5F5F5] rounded-md px-1"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    slotProps={{
                        input: {
                            disableUnderline: true,
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: filterText && (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setFilterText('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                            sx: {
                                height: 36,
                                fontSize: 14,
                                paddingX: 1,
                            },
                        },

                        htmlInput: {
                            style: {
                                padding: 0,
                                fontSize: 14,
                            },
                        }
                    }} />
            </div>
            <TableContainer className="shadow-none rounded-md border-none overflow-auto max-h-[calc(100vh-370px)]" component={Paper}>
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
                        {sortedData.map((row, index) => (
                            <TableRow hover key={index}>
                                <TableCell className={defaultStyle}>{row.start_time}</TableCell>
                                <TableCell className={defaultStyle}>{row.end_time}</TableCell>
                                <TableCell className={defaultStyle}>{row.distance.toLocaleString()}</TableCell>
                                <TableCell className={defaultStyle}>{row.current_vehicle_name}</TableCell>
                                <TableCell className={defaultStyle}>{row.simulation_vehicle_name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};
