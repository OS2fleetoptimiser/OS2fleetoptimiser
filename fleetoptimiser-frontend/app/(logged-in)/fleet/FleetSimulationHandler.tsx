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
            simulation.query.data.result
        ) {
            return convertDataToSimulationResults(simulation.query.data.result);
        }
        return undefined;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    }, [simulation.query.data?.status, simulation.query.data?.result]);

    return (
        <div className="w-auto max-w-[1800px] rounded-md m-auto p-1">
            <Tabs
                value={value}
                onChange={(e, v) => setValue(v)}
                aria-label="Simulerings Tabs"
                TabIndicatorProps={{
                    hidden: true,
                }}
                sx={{
                    // sx necessary to access these styles
                    '& .MuiTabs-flexContainer': {
                        backgroundColor: '#f5f5f5',
                        borderRadius: '5px',
                        padding: '6px',
                        width: 'fit-content',
                    },
                    '& .MuiTab-root': {
                        borderRadius: '5px',
                        backgroundColor: '#f5f5f5',
                        color: 'gray',
                        minWidth: 120,
                        minHeight: 36,
                        padding: '6px 16px',
                        '&:hover': {
                            backgroundColor: '#e0e0e0',
                        },
                    },
                    '& .MuiTab-root.Mui-selected': {
                        backgroundColor: 'white',
                        color: 'black',
                        fontWeight: 'bold',
                    },
                }}
            >
                <Tab
                    value={0}
                    label="Simuleringsopsætning"
                    icon={<TuneIcon />}
                    iconPosition="start"
                    sx={{
                        '&.Mui-selected': {
                            backgroundColor: 'white',
                        },
                    }}
                />
                <Tab
                    value={1}
                    label="Resultater"
                    icon={<InsightsIcon />}
                    iconPosition="start"
                    sx={{
                        '&.Mui-selected': {
                            backgroundColor: 'white',
                        },
                    }}
                />
            </Tabs>
            <div className="p-1 bg-white mt-4">
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
