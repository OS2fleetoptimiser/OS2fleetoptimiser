import { SimulationHighlight } from '@/components/hooks/useGetLandingPage';
import { Chip, Tooltip } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MemoryIcon from '@mui/icons-material/Memory';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useRouter } from 'next/navigation';

function cutCharacters(str: string, cutAbove: number = 20) {
    return str.length > cutAbove ? str.slice(0, cutAbove) + '...' : str;
}

function getSimTypeChip(simulationType: 'goal' | 'fleet') {
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

function formatFleetChange(fleetChange: number) {
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

function getPlusMinusChip(value: number, extraLabel?: string) {
    return (
        <Chip
            variant="filled"
            label={`${Math.abs(value).toLocaleString()}${extraLabel ? ' ' + extraLabel : ''}`}
            className={value === 0 ? 'bg-white' : value > 0 ? 'bg-green-25 text-green-600 font-semibold' : 'bg-red-25 text-red-600 font-semibold'}
            icon={value === 0 ? undefined : value > 0 ? <AddIcon className="text-green-600 text-sm" /> : <RemoveIcon className="text-red-600 text-sm" />}
        />
    );
}

function getUnallocatedChip(value: number) {
    return (
        <Chip
            className={value === 0 ? 'bg-green-25 text-green-600 font-semibold' : 'bg-red-25 text-red-600 font-semibold'}
            label={value}
            icon={value === 0 ? <TaskAltIcon className="text-sm text-green-600" /> : <BlockIcon className="text-sm text-red-600" />}
        />
    );
}

export default function SimulationHighlights({ simulations }: { simulations: SimulationHighlight[] }) {
    const router = useRouter();
    const handleClick = (iD: string, simType: string) => {
        router.push(`/${simType}/${iD.replace('celery-task-meta-', '')}`)
    }
    return (
        <div className="w-full">
            <h3 className="text-lg font-semibold mb-4">Seneste simuleringer</h3>
            <div className="overflow-x-auto my-4 shadow-sm">
                <div className="table w-full border border-gray-100 rounded-md">
                    <div className="table-header-group text-left text-gray-500 text-sm bg-gray-50">
                        <div className="table-row py-3 font-bold">
                            <div className="table-cell p-3">Dato</div>
                            <div className="table-cell p-3">Flådeændring</div>
                            <div className="table-cell p-3">Besparelse (kr)</div>
                            <div className="table-cell p-3">Reduktion (CO2e)</div>
                            <div className="table-cell p-3">Uallokerede rundture</div>
                            <div className="table-cell p-3">Lokation</div>
                            <div className="table-cell p-3">Type</div>
                        </div>
                    </div>
                    <div className="table-row-group">
                        {simulations &&
                            simulations.map((sim, index) => (
                                <div
                                    key={`${index}simHighlight`}
                                    className={`table-row hover:bg-gray-50 ${
                                        index + 1 !== simulations.length ? 'border-b border-gray-100' : ''
                                    } text-sm cursor-pointer`}
                                    onClick={() => handleClick(sim.id, sim.simulation_type)}
                                >
                                    <div className="table-cell p-3">{new Date(sim.simulation_date).toLocaleString()}</div>
                                    <div className="table-cell p-3">{formatFleetChange(sim.fleet_change)}</div>
                                    <div className="table-cell p-3">{getPlusMinusChip(sim.financial_savings)}</div>
                                    <div className="table-cell p-3">{getPlusMinusChip(sim.co2e_savings, 'Ton')}</div>
                                    <div className="table-cell p-3">{getUnallocatedChip(sim.unallocated)}</div>
                                    <div className="table-cell p-3">
                                        <Tooltip placement="top" title={sim.addresses.join(', ')}>
                                            <span>{cutCharacters(sim.addresses.join(', '))}</span>
                                        </Tooltip>
                                    </div>
                                    <div className="table-cell p-3">{getSimTypeChip(sim.simulation_type)}</div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
