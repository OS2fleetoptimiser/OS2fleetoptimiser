import useSimulateGoal from '@/components/hooks/useSimulateGoal';
import { useMemo } from 'react';
import SearchAbortedMessage from '@/app/(logged-in)/goal/SearchAborted';
import NoCarsSelectedMessage from '@/app/(logged-in)/goal/NoCarsSelected';
import NoTripsError from '@/app/(logged-in)/fleet/NoTripsError';
import LoadingOverlay from '@/components/LoadingOverlay';
import { SolutionComparisonBars } from '@/app/(logged-in)/goal/SolutionComparisonBars';
import TipsAutomatic from '@/app/(logged-in)/goal/TipsBetterSolutionsModal';
import NoSimulationResults from '@/app/(logged-in)/fleet/NoResults';
import { convertGoalDataToSimulationResults } from '@/app/(logged-in)/goal/ConvertGoalData';
import { SolutionsAccordion } from './SolutionsAccordion';

type GoalResultsOverviewProps = {
    simulation: ReturnType<typeof useSimulateGoal>;
};

export const GoalResultsOverview = ({ simulation }: GoalResultsOverviewProps) => {
    const convertedGoalResults = useMemo(() => {
        if (simulation.query.data?.status === 'SUCCESS' && simulation.query.data.result) {
            return convertGoalDataToSimulationResults(simulation.query.data);
        }
        return undefined;
    }, [simulation.query.data]);

    const solutions = simulation?.query?.data?.result?.solutions;
    const displayTips =
        solutions &&
        (solutions.length < 5 || solutions[0].simulation_expense > solutions[0].current_expense || solutions[0].simulation_co2e > solutions[0].current_co2e);

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
                <div className="space-y-4">
                    <SolutionComparisonBars solutions={convertedGoalResults.solutions} />
                    <SolutionsAccordion solutions={convertedGoalResults.solutions} simulationId={simulation.query.data?.id} />
                </div>
            )}
            {displayTips && (
                <div className="mb-4">
                    <TipsAutomatic />
                </div>
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
