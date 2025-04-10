import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { MetricCard } from './SimResultKPICard';

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
