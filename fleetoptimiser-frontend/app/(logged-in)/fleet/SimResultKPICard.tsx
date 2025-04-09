import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import ToolTip from '@/components/ToolTip';

interface MetricCardProps {
    title: string;
    keyfigure: string | number;
    basefigure: string | number;
    good: boolean;
    tooltipText?: string;
}

const MetricCard = ({ title, keyfigure, basefigure, good, tooltipText }: MetricCardProps) => {
    return (
        <div className="rounded-md shadow-sm border border-gray-100 bg-white p-4 pt-2">
            <div className="flex text-gray-500 text-sm items-center">
                {title}
                {tooltipText && <ToolTip>{tooltipText}</ToolTip>}
            </div>
            <div className="flex items-baseline justify-between mt-2">
                <span className={`text-xl font-bold ${good ? 'text-green-600' : 'text-red-600'}`}>{keyfigure}</span>
                <span className="text-sm text-gray-500">/ {basefigure}</span>
            </div>
        </div>
    );
};

export const SimResultHeader = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const costSaving = simulationResults.currentExpense - simulationResults.simulationExpense;
    const emissionSaving = simulationResults.currentEmission - simulationResults.simulationEmission;
    return (
        <div className="grid w-full grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
                title="Rundture uden køretøj"
                keyfigure={simulationResults.unallocatedTrips}
                basefigure={simulationResults.totalTrips}
                good={simulationResults.unallocatedTrips === 0}
                tooltipText="Antallet af ture, der ikke blev allokeret et køretøj i simuleringen. Det betyder, at der ikke var køretøjer ledige, der kunne acceptere turen ud fra tidspunkt og distance."
            />
            <MetricCard
                title="Årlig besparelse"
                keyfigure={`${costSaving.toLocaleString()} kr`}
                basefigure={`${simulationResults.currentExpense.toLocaleString()} kr`}
                good={costSaving >= 0}
                tooltipText="Kroner besparelse/forøgelse af den samlede årlige omkostning for puljen. Dette er de indtastede årlige omkostninger for køretøjerne inkl. drivmiddelforbrug - beregnet ud fra de kørete kilometer i simuleringen."
            />
            <MetricCard
                title="Årlig reduktion"
                keyfigure={`${emissionSaving.toLocaleString()} Ton CO2e`}
                basefigure={`${simulationResults.currentEmission.toLocaleString()} Ton CO2e`}
                good={emissionSaving >= 0}
                tooltipText="Den simulerede årlige reduktion/forøgelse i CO2e-udledning. Den faktiske udledning mod den simulerede udledning. Der bruges CO2e for at kunne sammenligne fossil- og elbiler. Beregningsmetoden baserer sig på POGI's miljøværktøj."
            />
        </div>
    );
};
