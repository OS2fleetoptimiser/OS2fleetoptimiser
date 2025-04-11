import {Chip} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import BlockIcon from "@mui/icons-material/Block";
import MemoryIcon from "@mui/icons-material/Memory";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";

export const formatFleetChange = (fleetChange: number) => {
    return (
        <Chip
            label={Math.abs(fleetChange)}
            className={
                fleetChange === 0
                    ? 'bg-white'
                    : fleetChange > 0
                    ? 'bg-red-25 text-red-600 font-semibold'
                    : 'bg-green-25 text-green-600 font-semibold'
            }
            icon={
                fleetChange === 0 ? undefined : fleetChange > 0 ? (
                    <ArrowDownwardIcon className="text-red-600 text-sm transform rotate-180" />
                ) : (
                    <ArrowDownwardIcon className="text-green-600 text-sm" />
                )
            }
        />
    );
}

export const getPlusMinusChip = (value: number, extraLabel?: string) => {
    return (
        <Chip
            variant="filled"
            label={`${Math.abs(value).toLocaleString()}${extraLabel ? ' ' + extraLabel : ''}`}
            className={value === 0 ? 'bg-white' : value > 0 ? 'bg-green-25 text-green-600 font-semibold' : 'bg-red-25 text-red-600 font-semibold'}
            icon={value === 0 ? undefined : value > 0 ? <AddIcon className="text-green-600 text-sm" /> : <RemoveIcon className="text-red-600 text-sm" />}
        />
    );
}

export const getUnallocatedChip = (value: number)=> {
    return (
        <Chip
            className={value === 0 ? 'bg-green-25 text-green-600 font-semibold' : 'bg-red-25 text-red-600 font-semibold'}
            label={value}
            icon={value === 0 ? <TaskAltIcon className="text-sm text-green-600" /> : <BlockIcon className="text-sm text-red-600" />}
        />
    );
}

export const getSimTypeChip = (simulationType: 'goal' | 'fleet') => {
    return (
        <>
            {simulationType === 'goal' && (
                <Chip
                    icon={<MemoryIcon className="text-blue-500" />}
                    className="bg-blue-25 font-semibold text-blue-500"
                    variant="filled"
                    label="Automatisk"
                />
            )}
            {simulationType === 'fleet' && <Chip icon={<DirectionsCarIcon />} className="bg-gray-50 font-semibold" variant="filled" label="Manuel" />}
        </>
    );
}
