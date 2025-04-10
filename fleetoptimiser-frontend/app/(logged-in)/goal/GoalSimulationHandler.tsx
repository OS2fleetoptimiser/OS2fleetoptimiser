'use client';
import { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import InsightsIcon from '@mui/icons-material/Insights';
import { GoalSimulation } from '@/app/(logged-in)/goal/GoalSimulation';
import useSimulateGoal from '@/components/hooks/useSimulateGoal';

import { GoalResultsOverview } from '@/app/(logged-in)/goal/GoalResultsTab';

export default function GoalSimulationHandler({ simulationId }: { simulationId?: string }) {
    const [value, setValue] = useState(simulationId === undefined ? 0 : 1);
    const simulation = useSimulateGoal(simulationId);

    return (
        <div className="w-auto max-w-[1800px] rounded-md m-auto p-1">
            <Tabs
                value={value}
                onChange={(e, v) => setValue(v)}
                aria-label="Automatisk Tabs"
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
                    label="Optimeringsopsætning"
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
                {value === 0 && <GoalSimulation simulation={simulation} setTab={setValue} />}
                {value === 1 && <GoalResultsOverview simulation={simulation} />}
            </div>
        </div>
    );
}
