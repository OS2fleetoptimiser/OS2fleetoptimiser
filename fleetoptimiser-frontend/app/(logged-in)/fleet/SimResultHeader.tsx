import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { MetricCard } from './SimResultKPICard';

export const SimResultHeader = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const costSaving = simulationResults.currentExpense - simulationResults.simulationExpense;
    const emissionSaving = simulationResults.currentEmission - simulationResults.simulationEmission;
    const costChangePercent = simulationResults.currentExpense !== 0
        ? (costSaving / simulationResults.currentExpense) * 100
        : 0;
    const emissionChangePercent = simulationResults.currentEmission !== 0
        ? (emissionSaving / simulationResults.currentEmission) * 100
        : 0;
    return (
        <div className="grid w-full grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
                title="Rundture uden køretøj"
                keyfigure={simulationResults.unallocatedTrips}
                good={simulationResults.unallocatedTrips === 0}
                caption={`ud af ${simulationResults.totalTrips} ture i alt`}
                tooltipText="Antallet af ture, der ikke blev allokeret et køretøj i simuleringen. Det betyder, at der ikke var køretøjer ledige, der kunne acceptere turen ud fra tidspunkt og distance."
            />
            <MetricCard
                title="Årlig besparelse"
                keyfigure={`${costSaving.toLocaleString()} kr`}
                good={costSaving >= 0}
                caption={`nuværende udgift: ${simulationResults.currentExpense.toLocaleString()} kr`}
                tooltipText="Kroner besparelse/forøgelse af den samlede årlige omkostning for puljen. Dette er de indtastede årlige omkostninger for køretøjerne inkl. drivmiddelforbrug - beregnet ud fra de kørete kilometer i simuleringen."
                changePercent={costChangePercent}
            />
            <MetricCard
                title="Årlig reduktion"
                keyfigure={`${emissionSaving.toLocaleString()} Ton CO2e`}
                good={emissionSaving >= 0}
                caption={`nuværende udledning: ${simulationResults.currentEmission.toLocaleString()} Ton CO2e`}
                tooltipText="Den simulerede årlige reduktion/forøgelse i CO2e-udledning. Den faktiske udledning mod den simulerede udledning. Der bruges CO2e for at kunne sammenligne fossil- og elbiler. Beregningsmetoden baserer sig på POGIs miljøværktøj."
                changePercent={emissionChangePercent}
            />
        </div>
    );
};
