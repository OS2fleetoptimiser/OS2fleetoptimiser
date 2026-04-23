import useSimulateGoal from '@/components/hooks/useSimulateGoal';
import SearchAbortedMessage from '@/app/(logged-in)/goal/SearchAborted';
import NoCarsSelectedMessage from '@/app/(logged-in)/goal/NoCarsSelected';
import NoTripsError from '@/app/(logged-in)/fleet/NoTripsError';
import LoadingOverlay from '@/components/LoadingOverlay';
import { SolutionComparisonBars } from '@/app/(logged-in)/goal/SolutionComparisonBars';
import TipsAutomatic from '@/app/(logged-in)/goal/TipsBetterSolutionsModal';
import NoSimulationResults from '@/app/(logged-in)/fleet/NoResults';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import EmptyState from '@/components/EmptyState';
import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { SolutionPicker } from './SolutionPicker';
import { SolutionComparisonTable } from './SolutionComparisonTable';
import PageTitle from '@/components/PageTitle';

type GoalResultsOverviewProps = {
    simulation: ReturnType<typeof useSimulateGoal>;
    convertedGoalResults?: { solutions: SimulationResults[] };
};

export const GoalResultsOverview = ({ simulation, convertedGoalResults }: GoalResultsOverviewProps) => {
    const displayTips =
        convertedGoalResults &&
        (convertedGoalResults.solutions.length < 5 ||
         convertedGoalResults.solutions[0].simulationExpense > convertedGoalResults.solutions[0].currentExpense ||
         convertedGoalResults.solutions[0].simulationEmission > convertedGoalResults.solutions[0].currentEmission);

    return (
        <div>
            {simulation.query.data?.status === 'SUCCESS' && !simulation.query.data?.result.solutions && unexpectedResult(simulation.query.data.result.message)}
            {simulation.query.data && isSimulating(simulation.query.data?.status) && simulation.running && (
                <LoadingOverlay
                    status={simulation.query.data.status}
                    progress={simulation.query.data.progress.progress * 100}
                    setCancel={simulation.stopSimulation}
                    pendingText={simulation.query.data.progress.task_message}
                />
            )}

            {convertedGoalResults && convertedGoalResults.solutions.length > 0 && (
                <div>
                    <PageTitle level="section" title="Sammenligning" />
                    {displayTips && (
                        <div className="mb-4">
                            <TipsAutomatic />
                        </div>
                    )}
                    <div className="space-y-6">
                        <SolutionComparisonBars solutions={convertedGoalResults.solutions} />
                        <SolutionComparisonTable solutions={convertedGoalResults.solutions} />
                    </div>
                    <SolutionPicker solutions={convertedGoalResults.solutions} simulationId={simulation.query.data?.id} />
                </div>
            )}
            {convertedGoalResults && convertedGoalResults.solutions.length === 0 && (
                <EmptyState icon={<SearchOffIcon color="action" fontSize="large" />}>
                    Der blev ikke fundet nogen løsninger i den automatiske simulering.
                    <br />
                    Prøv at justere dine optimeringsindstillinger og kør simuleringen igen.
                </EmptyState>
            )}
            {!convertedGoalResults && !isSimulating(simulation.query.status) && !simulation.running && <NoSimulationResults />}
        </div>
    );
};

const isSimulating = (status: string | undefined) => {
    switch (status) {
        case 'PENDING':
        case 'STARTED':
        case 'PROGRESS':
            return true;
        default:
            return false;
    }
};

const unexpectedResult = (message?: string) => {
    switch (message) {
        case 'Search aborted.':
            return <SearchAbortedMessage />;
        case 'No cars selected.':
            return <NoCarsSelectedMessage />;
        default:
            return <NoTripsError />;
    }
};
