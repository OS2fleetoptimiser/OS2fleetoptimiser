'use client';

import { usePatchGetLoginTime } from '@/components/hooks/userLoginTime';
import { useSession } from 'next-auth/react';
import LoginHeader from '@/app/(logged-in)/(landing-page)/LoginHeader';
import LandingPageKPIs from '@/app/(logged-in)/(landing-page)/KPIs';
import SimulationHighlights from '@/app/(logged-in)/(landing-page)/SimulationHighlights';
import { useGetSimulationHighlights, useGetUsageGraphData, useGetActivityGraphData, useGetLandingPageKPIs } from '@/components/hooks/useGetLandingPage';
import { Button, CircularProgress } from '@mui/material';
import Link from 'next/link';
import LandingPageGraphs from '@/app/(logged-in)/(landing-page)/LandingPageGraphs';
import NoConnectionError from '@/app/(logged-in)/(landing-page)/NoConnectionError';
import NoSimulations from '@/app/(logged-in)/(landing-page)/NoSimulations';

export default function Home() {
    const { data: session } = useSession();
    const providerAccountId = session?.user?.providerAccountId || 'developer';
    const { data: lastLogin, isLoading: loginIsLoading } = usePatchGetLoginTime(providerAccountId);
    const { data: kpiData, isLoading: isKPIsLoading } = useGetLandingPageKPIs();
    const { data: latestSimulations, isLoading: simulationsIsLoading } = useGetSimulationHighlights();
    const { data: usageGraphData } = useGetUsageGraphData();
    const { data: activityGraphData } = useGetActivityGraphData();

    return (
        <div className="pt-4 space-y-12 flex flex-col max-w-[1105px] mx-auto">
            <LoginHeader lastLogin={lastLogin} isLoading={loginIsLoading} />
            {!isKPIsLoading && kpiData && Object.keys(kpiData).length > 0 && <LandingPageKPIs data={kpiData} />}
            {!isKPIsLoading && (!kpiData || Object.keys(kpiData).length === 0) && <NoConnectionError />}
            {isKPIsLoading && <CircularProgress />}
            <div className="w-full">
                {!simulationsIsLoading && latestSimulations && latestSimulations.length > 0 && (
                    <div>
                        <SimulationHighlights simulations={latestSimulations} />
                    </div>
                )}
                {!simulationsIsLoading && (!latestSimulations || latestSimulations.length === 0) && <NoSimulations />}
                {!simulationsIsLoading && (
                    <div key="buttongroup" className="flex flex-row items-center space-x-4">
                        <Link href={'/setup'}>
                            <Button size="small" color="primary" variant="contained">
                                Start ny simulering
                            </Button>
                        </Link>
                        <Link href={'/simulation-history'}>
                            <Button size="small" className="text-gray-700 border-gray-700" variant="outlined">
                                Simuleringshistorik
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
            <div className="graphs">
                {usageGraphData && activityGraphData && usageGraphData.length > 0 && <LandingPageGraphs activityData={activityGraphData} usageData={usageGraphData} />}
                {/*  if we don't get this data, we won't get KPI data either, so we stick to one error message at the top  */}
            </div>
        </div>
    );
}
