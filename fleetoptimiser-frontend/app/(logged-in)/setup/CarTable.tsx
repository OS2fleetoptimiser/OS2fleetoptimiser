'use client';

import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import { addCar, clearCars, removeCarById } from '@/components/redux/SimulationSlice';
import { MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { Column, ColumnFilter, createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, Table, useReactTable } from '@tanstack/react-table';
import { ReactNode, useState } from 'react';
import ToolTip from '../../../components/ToolTip';
import { VehicleWithStatus } from '../../../components/hooks/useGetVehiclesByLocation';
import { useAppDispatch, useAppSelector } from '../../../components/redux/hooks';

import PedalBikeIcon from '@mui/icons-material/PedalBike';
import ElectricBikeIcon from '@mui/icons-material/ElectricBike';
import ElectricCarIcon from '@mui/icons-material/ElectricCar';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const columnHelper = createColumnHelper<VehicleWithStatus>();

type props = {
    cars: VehicleWithStatus[];
    selectedDepartments: [];
    setSelectedDepartments: any;
};

const CarCheckBox = ({ car }: { car: VehicleWithStatus }) => {
    const dispatch = useAppDispatch();

    return (
        <Checkbox
            disabled={car.status === 'dataMissing'}
            onChange={(e) => {
                if (e.target.checked) {
                    dispatch(addCar(car));
                } else {
                    dispatch(removeCarById(car.id));
                }
            }}
            checked={!!useAppSelector((state) => state.simulation.selectedVehicles.find((c) => c.id === car.id))}
        />
    );
};

const CarTable = ({ cars, selectedDepartments, setSelectedDepartments }: props) => {
    const propellantFormat = (vehicle: VehicleWithStatus) => {
        if (vehicle.wltp_el) {
            return vehicle.wltp_el.toLocaleString() + ' Wh/km';
        } else if (vehicle.wltp_fossil) {
            return vehicle.wltp_fossil.toLocaleString() + ' km/l';
        } else {
            return 'Intet drivmiddel';
        }
    };

    const iconLookup = (vtype: string | undefined): ReactNode => {
        switch (vtype) {
            case 'fossilbil':
                return <DirectionsCarIcon className="mr-2" />;
            case 'elbil':
                return <ElectricCarIcon className="mr-2" />;
            case 'elcykel':
                return <ElectricBikeIcon className="mr-2" />;
            case 'cykel':
                return <PedalBikeIcon className="mr-2" />;
            case undefined:
                return <HelpOutlineIcon className="mr-2" />;
        }
    };

    const defaultColumns = [
        columnHelper.display({
            id: 'Type',
            header: () => <div className="text-left items-center">Biltype</div>,
            cell: (props) => {
                switch (props.row.original.status) {
                    case 'ok':
                        return <span className="flex items-center space-x-2 gap-1">
                            {iconLookup(props.row.original.type?.name)}
                            {props.row.original.name}
                        </span>;
                    case 'dataMissing':
                        return (
                            <span className="text-red-600 flex items-center space-x-2 gap-1">
                                {iconLookup(props.row.original.type?.name)}
                                {props.row.original.name}
                                <ToolTip>
                                    Køretøjet mangler metadata, men har været aktiv på lokationen i den valgte datoperiode. Gå til konfigurationen, find
                                    køretøjet og tilføj som minimum mærke, model, wltp og omkostning år for køretøjet.
                                </ToolTip>
                            </span>
                        );
                    case 'locationChanged':
                        return (
                            <span className="text-yellow-600 flex items-center space-x-2 gap-1">
                                {iconLookup(props.row.original.type?.name)}
                                {props.row.original.name}
                                <ToolTip>
                                    Køretøjet har fået skiftet sin lokation, men har været aktiv på denne lokation i den valgte datoperiode. Dvs. køretøjet er
                                    tilknyttet en anden lokation end denne og vil fremover kun bidrage med nye ture til lokationen valgt i konfigurationen.
                                </ToolTip>
                            </span>
                        );
                    case 'leasingEnded':
                        return (
                            <span className="text-yellow-600 flex items-center space-x-2 gap-1">
                                {iconLookup(props.row.original.type?.name)}
                                {props.row.original.name}
                                <ToolTip>
                                    Køretøjet har overgået slut-dato for leasingperioden, men har fortsat været aktiv på lokationen i den valgte datoperiode. Gå
                                    til konfigurationen for at ændre datoen for den valgte slut-dato.
                                </ToolTip>
                            </span>
                        );
                    case 'notActive':
                        return (
                            <span className="text-blue-600 flex items-center space-x-2 gap-1">
                                {iconLookup(props.row.original.type?.name)}
                                {props.row.original.name}
                                <ToolTip>Køretøjet er tilknyttet denne lokation, men har ikke været aktiv i den valgte datoperiode.</ToolTip>
                            </span>
                        );
                }
            },
        }),
        columnHelper.accessor((row) => row.omkostning_aar, {
            id: 'Cost',
            header: () => <div className="text-right">Årlige omkostninger (DKK)</div>,
            cell: (row) => <div className="text-right">{row.getValue()?.toLocaleString() + ' kr/år'}</div>,
        }),
        columnHelper.accessor((row) => row.department, {
            id: 'department',
            header: (row) => (
                <Filter
                    tableRef={row.table}
                    values={cars.reduce((departments: string[], car) => {
                        const existing = departments.find((item) => item === car.department);
                        if (!existing) departments.push(car.department ?? '');
                        return departments;
                    }, [])}
                    selectedDepartments={selectedDepartments}
                    setSelectedDepartments={setSelectedDepartments}
                    column={row.column}
                ></Filter>
            ),
            cell: (row) => <div>{row.getValue() ? row.getValue() : 'Ingen afdeling'}</div>,
        }),
        columnHelper.display({
            id: 'consumption',
            header: () => <div className="text-right">Drivmiddel forbrug</div>,
            cell: (props) => <div className="text-right">{propellantFormat(props.row.original)}</div>,
        }),
        columnHelper.display({
            id: 'Selector',
            header: 'Medtag i simulation',
            cell: (props) => (
                <div className="text-center">
                    <CarCheckBox car={props.row.original}></CarCheckBox>
                </div>
            ),
        }),
    ];

    const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

    const table = useReactTable({
        data: cars,
        columns: defaultColumns,
        enableFilters: true,
        state: {
            columnFilters,
        },
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <div className="w-full overflow-x-scroll list-text">
            <table className="w-full border-collapse mb-2">
                <thead className="border-b">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr className="border-b" key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th className="p-2" key={header.id}>
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
                                <td className="px-2" key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

function Filter({
    column,
    values,
    selectedDepartments,
    setSelectedDepartments,
    tableRef,
}: {
    column: Column<any, unknown>;
    values: string[];
    selectedDepartments: any;
    setSelectedDepartments: any;
    tableRef: Table<VehicleWithStatus>;
}) {
    const dispatch = useAppDispatch();
    const [afdeling, setAfdeling] = useState<string[]>([]);
    const handleChange = (event: SelectChangeEvent<typeof afdeling>) => {
        const {
            target: { value },
        } = event;
        let selectedDepartment = typeof value === 'string' ? value.split(',') : value;
        let copySelectedDepartments = [...selectedDepartments];
        if (selectedDepartments.includes(selectedDepartment)) {
            copySelectedDepartments = copySelectedDepartments.filter((dep) => dep !== selectedDepartment);
        } else {
            copySelectedDepartments.push(selectedDepartment);
        }
        const rows = tableRef.getPreFilteredRowModel();
        dispatch(clearCars());
        if (selectedDepartment.includes('alle') && selectedDepartment[selectedDepartment.length - 1] === 'alle') {
            setSelectedDepartments(['alle']);
            rows.rows.map((row) => dispatch(addCar(row.original)));
        } else {
            setSelectedDepartments(selectedDepartment.filter((dep) => dep !== 'alle'));
            rows.rows
                .filter((row) => selectedDepartment.includes(typeof row.original.department === 'string' ? row.original.department : ''))
                .forEach((row) => dispatch(addCar(row.original)));
        }
    };

    return (
        <FormControl style={{ width: '200px' }}>
            <InputLabel id="demo-simple-select-label">Afdeling</InputLabel>
            <Select labelId="demo-simple-select-label" id="demo-simple-select" label="Afdeling" multiple onChange={handleChange} value={selectedDepartments}>
                <MenuItem value="alle">Alle</MenuItem>
                {values.map((item) => (
                    <MenuItem key={item} value={item}>
                        {item}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

export default CarTable;
