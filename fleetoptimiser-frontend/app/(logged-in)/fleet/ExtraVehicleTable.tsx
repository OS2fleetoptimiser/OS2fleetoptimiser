import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { Checkbox, Paper, TableContainer } from '@mui/material';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, getSortedRowModel } from '@tanstack/react-table';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import {
    addExtraVehicle,
    addTestVehicle,
    addTestVehicleMeta,
    removeExtraVehicle,
    removeTestVehicle,
    removeTestVehicleMeta,
} from '@/components/redux/SimulationSlice';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { BpIcon, BpCheckedIcon } from '@/app/(logged-in)/setup/CheckBoxIcons';

const columnHelper = createColumnHelper<Vehicle>();

const ExtraVehicleControl = ({ vehicle }: { vehicle: Vehicle }) => {
    const dispatch = useAppDispatch();
    const extraVehicleExist = useAppSelector((state) => state.simulation.fleetSimulationSettings.extraVehicles.some((v) => v.id === vehicle.id));
    return (
        <Checkbox
            sx={{ '&:hover': { bgcolor: 'transparent' } }}
            checkedIcon={<BpCheckedIcon />}
            icon={<BpIcon />}
            onChange={(e) => {
                console.log('check');
                if (vehicle) {
                    if (e.target.checked) {
                        dispatch(addExtraVehicle(vehicle));
                        dispatch(addTestVehicle(vehicle.id));
                        dispatch(addTestVehicleMeta(vehicle));
                    } else {
                        dispatch(removeExtraVehicle(vehicle));
                        dispatch(removeTestVehicle(vehicle.id));
                        dispatch(removeTestVehicleMeta(vehicle));
                    }
                }
            }}
            checked={extraVehicleExist}
        />
    );
};

const ExtraVehicleTable = ({ cars }: { cars: Vehicle[] }) => {
    // Can you select vehicles from the current fleet?
    const defaultColumns = [
        columnHelper.display({
            id: 'Type',
            header: () => <div className="text-left">Biltype</div>,
            cell: (props) => (
                <div>
                    {props.row.original.make} {props.row.original.model}
                </div>
            ),
        }),
        columnHelper.display({
            id: 'Consumption',
            header: () => <div className="text-right">Drivmiddel forbrug</div>,
            cell: (props) => (
                <div className="text-right">
                    {props.row.original.wltp_el
                        ? `${props.row.original.wltp_el} Wh/km`
                        : props.row.original.wltp_fossil
                        ? `${props.row.original.wltp_fossil} km/l`
                        : 'Ikke udfyldt'}
                </div>
            ),
        }),
        columnHelper.accessor((row) => row.omkostning_aar, {
            id: 'Cost',
            header: () => <div className="text-right">Årlige omkostninger (DKK)</div>,
            cell: (row) => <div className="text-right">{row.getValue()}</div>,
        }),
        columnHelper.display({
            id: 'Selector',
            header: 'Vælg',
            cell: (props) => (
                <div className="text-center">
                    <ExtraVehicleControl vehicle={props.row.original} />
                </div>
            ),
        }),
    ];

    const table = useReactTable({
        data: cars,
        columns: defaultColumns,
        getCoreRowModel: getCoreRowModel(),
        initialState: { sorting: [{ id: 'Cost', desc: false }] },
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <TableContainer
            component={Paper}
            className="relative my-4 shadow-sm border border-gray-200 rounded-md max-h-[calc(100vh-250px)] overflow-auto"
        >
            <Table stickyHeader>
                <TableHead>
                    {table.getHeaderGroups().map((headerGroup, index) => (
                        <TableRow key={`${index}_hgroup`}>
                            {headerGroup.headers.map((header) => (
                                <TableCell key={header.id} className="p-3 text-gray-500 text-sm font-bold bg-gray-50">
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableHead>
                <TableBody>
                    {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell className="p-1 px-3 text-sm" key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ExtraVehicleTable;
