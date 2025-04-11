import { SimulationHighlight } from '@/components/hooks/useGetLandingPage';
import { Tooltip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { formatFleetChange, getPlusMinusChip, getUnallocatedChip, getSimTypeChip } from './ChipFormatting';

function cutCharacters(str: string, cutAbove: number = 20) {
    return str.length > cutAbove ? str.slice(0, cutAbove) + '...' : str;
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
