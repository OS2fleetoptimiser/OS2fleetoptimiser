'use client';

import { createColumnHelper, useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { useMemo } from 'react';
import { InputAdornment, TextField } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { setGoalSimulationVehicles } from '@/components/redux/SimulationSlice';
import Tooltip from "@mui/material/Tooltip";

export type CarGoal = Vehicle & { original: number[], testVehicle: boolean };

const columnHelper = createColumnHelper<CarGoal>();

const propellantFormat = (vehicle: Vehicle) => {
    if (vehicle.wltp_el) {
        return vehicle.wltp_el.toLocaleString() + ' Wh/km';
    } else if (vehicle.wltp_fossil) {
        return vehicle.wltp_fossil.toLocaleString() + ' km/l';
    } else {
        return 'Intet drivmiddel';
    }
};

type amountProps = {
    availableVehicles: number[];
};

const AmountInput = ({ availableVehicles }: amountProps) => {
    const dispatch = useAppDispatch();

    const allGoalSimulationVehicles = useAppSelector((state) => state.simulation.goalSimulationSettings.fixed_vehicles);

    const handleChange = (input: string) => {
        if (Number.isNaN(+input) || +input > availableVehicles.length) return;
        const idsToAdd = availableVehicles.slice(0, +input);
        let updatedSimulationVehicles = allGoalSimulationVehicles.filter((v) => !availableVehicles.includes(v));
        updatedSimulationVehicles = updatedSimulationVehicles.concat(idsToAdd);
        dispatch(setGoalSimulationVehicles(updatedSimulationVehicles));
    };

    return (
        <TextField
            variant="standard"
            value={allGoalSimulationVehicles.filter((value) => availableVehicles.includes(value)).length}
            onChange={(e) => handleChange(e.target.value)}
            slotProps={{
                input: {
                    endAdornment: <InputAdornment position="start">/{availableVehicles.length}</InputAdornment>,
                    inputProps: {
                        style: { textAlign: 'right' },
                    },
                }
            }}
        ></TextField>
    );
};

const AmountEmpty = () => {
    return (
        <Tooltip title="Du har valgt køretøjet som et testkøretøj til simuleringen.
        Det betyder, at den nu kan benyttes af AI-modellen i flådesammensætning, hvis det er fordelagtigt i løsningen.">
            <TextField
                variant="standard"
                disabled={true}
                value={0}
                className="text-blue-600"
                sx={{
                    '& .MuiInputBase-root': {
                        color: '#2563eb',
                    },
                }}
                slotProps={{
                    input: {
                        endAdornment: <InputAdornment position="start"><span style={{ color: '#ababab' }}> /0</span></InputAdornment>,
                        inputProps: {
                            style: { textAlign: 'right'},
                        },
                    }
                }}
            >
            </TextField>
        </Tooltip>
    );
}

const defaultColumns = [
    columnHelper.display({
        id: 'Type',
        header: () => <div className="text-left">Biltype</div>,
        cell: (row) => {
            const fullText = row.row.original.make + ' ' + row.row.original.model
            const truncatedText = fullText.length > 30 ? fullText.substring(0, 30) + '...' : fullText;
            return (
                <span className={row.row.original.testVehicle ? "text-blue-600" : "text-black"} title={fullText}>
                    {truncatedText}
                </span>
            );
        },
    }),
    columnHelper.accessor((row) => row.omkostning_aar, {
        id: 'Cost',
        header: () => <div className="text-right">Årlig omkostning (DKK)</div>,
        cell: (row) => <div className={row.row.original.testVehicle ? "text-blue-600 text-right" : "text-black text-right"}>{row.getValue()?.toLocaleString()}</div>,
    }),
    columnHelper.display({
        id: 'Consumption',
        header: () => <div className="text-right">Drivmiddel forbrug</div>,
        cell: (props) => <div className={props.row.original.testVehicle ? "text-blue-600 text-right" : "text-black text-right"}>{propellantFormat(props.row.original)}</div>,
    }),
    columnHelper.accessor((row) => row.original, {
        id: 'Amount',
        header: () => <div className="text-right">Antal i beholdning</div>,
        cell: (row) => {
            return !row.row.original.testVehicle ? <div className="simantal text-black text-right">
                <AmountInput availableVehicles={row.getValue()}></AmountInput>
            </div> : <div className="simantal text-blue-600 text-right"><AmountEmpty/></div>
        }
    }),
    columnHelper.accessor((row) => row.end_leasing, {
        id: 'EndLeasing',
        header: () => <div className="text-right">Slutleasing</div>,
        cell: (row) => <div className={row.row.original.testVehicle ? "text-blue-600 text-right" : "text-black text-right"}>{row.getValue() ? dayjs(row.getValue()).format('DD-MM-YYYY') : 'Ingen dato'}</div>,
    }),
];

const SimulationFleet = ({ vehicles, testVehicles }: { vehicles: Vehicle[], testVehicles: Vehicle[] }) => {
    //Something about reactTable causes infinite rerenders if we don't memoize the reduced cars
    const reduced = useMemo(
        () => {
            const vehs = vehicles.reduce((acc: CarGoal[], cur) => {
                const existing = acc.find(
                    (car) =>
                        car.make === cur.make &&
                        car.model === cur.model &&
                        car.omkostning_aar === cur.omkostning_aar &&
                        car.wltp_el === cur.wltp_el &&
                        car.wltp_fossil === cur.wltp_fossil &&
                        car.end_leasing === cur.end_leasing
                );
                if (existing) {
                    existing.original.push(cur.id);
                } else {
                    acc.push({...cur, original: [cur.id], testVehicle: false});
                }
                return acc;
            }, [])
            testVehicles.forEach((testveh) => {
                vehs.push({...testveh, original: [testveh.id], testVehicle: true})
            })
            return vehs
        },
        [vehicles, testVehicles]
    );

    const table = useReactTable({ data: reduced, columns: defaultColumns, getCoreRowModel: getCoreRowModel() });

    return (
        <table className="w-full border-collapse">
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
                            <td className="p-2" key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default SimulationFleet;
