import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatFleetChange, getPlusMinusChip, getUnallocatedChip } from '@/app/(logged-in)/(landing-page)/SimulationHighlights';
import { SimulationResultsPage } from '@/app/(logged-in)/fleet/SimulationResults';

export function SolutionsAccordion({ solutions, simulationId }: { solutions: SimulationResults[]; simulationId?: string }) {
    return (
        <div className="w-full">
            {solutions.map((sol, i) => {
                const vehDifference = sol.vehicleDifferences.reduce((sum: number, vhDifference) => sum + Number(vhDifference.changeCount), 0);
                const costDifference = sol.currentExpense - sol.simulationExpense;
                const emissionDifference = sol.currentEmission - sol.simulationEmission;

                return (
                    <Accordion key={i} className="shadow-sm border border-gray-100 rounded-md mb-2">
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} className="px-4">
                            <div className="table w-full text-sm text-gray-600">
                                <div className="table-row">
                                    <div className="table-cell font-semibold pr-8">Løsning {i + 1}</div>
                                    <div className="table-cell hidden xl:table-cell">Ændring i antal køretøjer: {formatFleetChange(vehDifference)}</div>
                                    <div className="table-cell">Besparelse: {getPlusMinusChip(costDifference, 'DKK/år')}</div>
                                    <div className="table-cell">Reduktion: {getPlusMinusChip(emissionDifference, 'Ton CO2e/år')}</div>
                                    <div className="table-cell hidden 2xl:table-cell">Ikke tildelte ture: {getUnallocatedChip(sol.unallocatedTrips)}</div>
                                </div>
                            </div>
                        </AccordionSummary>
                        <AccordionDetails className="overflow-auto">
                            <SimulationResultsPage isLoading={false} simulationResults={sol} simulationId={simulationId} />
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </div>
    );
}
