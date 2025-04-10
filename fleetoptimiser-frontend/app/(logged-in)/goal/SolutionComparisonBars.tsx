import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import ToolTip from '@/components/ToolTip';
import { CostComparisonBar } from '@/app/(logged-in)/goal/ComparisonBar';

export const SolutionComparisonBars = ({ solutions }: { solutions: SimulationResults[] }) => {
    const cost = solutions.map((sol, i) => ({ value: sol.simulationExpense, label: `Løsning ${i + 1}` }));
    const currentCost = solutions[0].currentExpense;

    const emission = solutions.map((sol, i) => ({ value: sol.simulationEmission, label: `Løsning ${i + 1}` }));
    const currentEmission = solutions[0].currentEmission;
    return (
        <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6 h-auto xl:h-96">
            <div className="border border-gray-100 shadow-sm rounded-md w-full h-96 p-4 pt-2">
                <span className="text-sm font-semibold">Omkostningssammenligning (DKK/år)</span>
                <ToolTip>
                    Den samlede årlige besparelse for den højeste rangerede løsning sammenlignet med den nuværende flåde. Beløbet er summeret fra de udvalgte
                    køretøjers årlige omkostninger og de beregnede simulerede omkostninger forbundet med driften. Drivmiddelforbrug er baseret på POGI
                    miljøværktøj.
                </ToolTip>
                <CostComparisonBar currentValue={currentCost} solutions={cost} yAxis="DKK/år" />
            </div>
            <div className="border border-gray-100 shadow-sm rounded-md w-full h-96 p-4 pt-2">
                <span className="text-sm font-semibold">Udledningssammenligning (Ton CO2e/år)</span>
                <ToolTip>
                    Den samlede årlige reduktion i CO2e-udledning for den højeste rangerede løsning. Tallet er beregnet vha. POGI miljøværktøj, hvorfra det
                    udvalgte køretøjs allokerede ture, er udgangspunkt for det enkelte køretøjs årlige CO2e. Tallet er summeret fra den valgte dataperiode til
                    årsværk.
                </ToolTip>
                <CostComparisonBar currentValue={currentEmission} solutions={emission} yAxis="Tons CO2e/år" />
            </div>
        </div>
    );
};
