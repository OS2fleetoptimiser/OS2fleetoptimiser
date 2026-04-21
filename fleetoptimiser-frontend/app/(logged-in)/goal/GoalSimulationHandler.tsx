'use client';
import { useMemo, useState } from 'react';
import { Divider, Tabs, Tab } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import InsightsIcon from '@mui/icons-material/Insights';
import { GoalSimulation } from '@/app/(logged-in)/goal/GoalSimulation';
import useSimulateGoal from '@/components/hooks/useSimulateGoal';
import { GoalResultsOverview } from '@/app/(logged-in)/goal/GoalResultsTab';
import { convertGoalDataToSimulationResults } from '@/app/(logged-in)/goal/ConvertGoalData';

export default function GoalSimulationHandler({ simulationId }: { simulationId?: string }) {
    const [value, setValue] = useState(simulationId === undefined ? 0 : 1);
    const simulation = useSimulateGoal(simulationId);

    const convertedGoalResults = useMemo(() => {
        if (simulation.query.data?.status === 'SUCCESS' && simulation.query.data.result) {
            return convertGoalDataToSimulationResults(simulation.query.data);
        }
        return undefined;
    }, [simulation.query.data]);

    return (
        <div>
            <Tabs
                value={value}
                onChange={(_, v) => setValue(v)}
                aria-label="Automatisk Tabs"
            >
                <Tab
                    value={0}
                    label="Optimeringsopsætning"
                    icon={<TuneIcon />}
                    iconPosition="start"
                />
                <Tab
                    value={1}
                    label="Resultater"
                    icon={<InsightsIcon />}
                    iconPosition="start"
                />
            </Tabs>
            <Divider />
            <div className="mt-4">
                {value === 0 && <GoalSimulation simulation={simulation} setTab={setValue} />}
                {value === 1 && (
                    <GoalResultsOverview
                        simulation={simulation}
                        convertedGoalResults={convertedGoalResults}
                    />
                )}
            </div>
        </div>
    );
}
