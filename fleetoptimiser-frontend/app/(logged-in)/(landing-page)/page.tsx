'use client';

import { usePatchGetLoginTime } from '@/components/hooks/userLoginTime';
import { useSession } from '@/lib/auth-client';
import PageTitle from '@/components/PageTitle';
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
    // Better Auth uses 'id' instead of 'providerAccountId'
    const providerAccountId = session?.user?.id || 'developer';
    const { data: lastLogin, isPending: loginIsLoading } = usePatchGetLoginTime(providerAccountId);
    const { data: kpiData, isPending: isKPIsLoading } = useGetLandingPageKPIs();
    const { data: latestSimulations, isPending: simulationsIsLoading } = useGetSimulationHighlights();
    const { data: usageGraphData } = useGetUsageGraphData();
    const { data: activityGraphData } = useGetActivityGraphData();

    return (
        <>
            <PageTitle
                title="Velkommen til FleetOptimiser"
                subtitle={!loginIsLoading && lastLogin ? `Dit seneste besøg var ${new Date(lastLogin).toLocaleString()}` : undefined}
            />
            <div className="flex flex-col space-y-4">
                {!isKPIsLoading && kpiData && Object.keys(kpiData).length > 0 && <LandingPageKPIs data={kpiData} />}
                {!isKPIsLoading && (!kpiData || Object.keys(kpiData).length === 0) && <NoConnectionError />}
                {isKPIsLoading && <CircularProgress />}
                {!simulationsIsLoading && latestSimulations && latestSimulations.length > 0 && (
                    <SimulationHighlights simulations={latestSimulations} />
                )}
                {!simulationsIsLoading && (!latestSimulations || latestSimulations.length === 0) && <NoSimulations />}
                {!simulationsIsLoading && (
                    <div className="flex flex-row items-center space-x-4">
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
                {usageGraphData && activityGraphData && usageGraphData.length > 0 && <LandingPageGraphs activityData={activityGraphData} usageData={usageGraphData} />}
                {/*  if we don't get this data, we won't get KPI data either, so we stick to one error message at the top  */}
            </div>
        </>
    );
}
