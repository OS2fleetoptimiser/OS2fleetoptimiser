'use client';
import { useMemo, useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import InsightsIcon from '@mui/icons-material/Insights';
import { FleetSimulation } from '@/app/(logged-in)/fleet/FleetSimulation';
import useSimulateFleet from '@/components/hooks/useSimulateFleet';
import { SimulationResultsPage } from '@/app/(logged-in)/fleet/SimulationResults';
import { convertDataToSimulationResults } from './ConvertData';

export default function FleetSimulationHandler({ simulationId }: { simulationId?: string }) {
    const [value, setValue] = useState(simulationId === undefined ? 0 : 1);
    const simulation = useSimulateFleet(simulationId);

    const convertedSimulationResults = useMemo(() => {
        if (
            simulation.query.data?.status === 'SUCCESS' &&
            simulation.query.data.result?.results
        ) {
            return convertDataToSimulationResults(simulation.query.data.result);
        }
        return undefined;
    }, [simulation.query.data]);

    return (
        <div>
            <Tabs
                value={value}
                onChange={(e, v) => setValue(v)}
                aria-label="Simulerings Tabs"
            >
                <Tab
                    value={0}
                    label="Simuleringsopsætning"
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
            <div className="mt-4">
                {value === 0 && <FleetSimulation simulation={simulation} setTab={setValue} />}
                {value === 1 && (
                    <SimulationResultsPage
                        isLoading={isSimulating(simulation.query.data?.status)}
                        simulationResults={convertedSimulationResults}
                        simulationId={simulation.query.data?.id}
                    />
                )}
            </div>
        </div>
    );
}

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
