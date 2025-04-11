import dayjs from 'dayjs';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

const columnHelper = createColumnHelper<Vehicle>();

const propellantFormat = (vehicle: Vehicle) => {
    if (vehicle.wltp_el) {
        return vehicle.wltp_el.toLocaleString() + ' Wh/km';
    } else if (vehicle.wltp_fossil) {
        return vehicle.wltp_fossil.toLocaleString() + ' km/l';
    } else {
        return 'Intet drivmiddel';
    }
};

const defaultColumns = [
    columnHelper.display({
        id: 'Type',
        header: () => <div className="text-left">Biltype</div>,
        cell: (row) => `${row.row.original.name}`,
    }),
    columnHelper.accessor((row) => row.omkostning_aar, {
        id: 'Cost',
        header: () => <div className="text-right">Årlig omkostning (DKK)</div>,
        cell: (row) => <div className="text-right">{row.getValue()?.toLocaleString()}</div>,
    }),
    columnHelper.display({
        id: 'Consumption',
        header: () => <div className="text-right">Drivmiddel forbrug</div>,
        cell: (props) => <div className="text-right">{propellantFormat(props.row.original)}</div>,
    }),
    columnHelper.accessor((row) => row.end_leasing, {
        id: 'EndLeasing',
        cell: (row) => <div className="text-right">{row.getValue() ? dayjs(row.getValue()).format('DD-MM-YYYY') : 'Ingen dato'}</div>,
        header: () => <div className="text-right">Slutleasing</div>,
    }),
];

const ComparisonFleet = ({ vehicles }: { vehicles: Vehicle[] }) => {
    const table = useReactTable({ data: vehicles, columns: defaultColumns, getCoreRowModel: getCoreRowModel() });

    return (
        <table className="relative my-4 shadow-none rounded-md w-full border-collapse">
            <thead className="border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                    <tr className="border-b" key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <th className="p-3 text-gray-500 text-sm font-bold bg-gray-50 items-center" key={header.id}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody>
                {table.getRowModel().rows.map((row) => (
                    <tr className="border-b" key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <td className="p-3 text-sm items-center" key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default ComparisonFleet;
