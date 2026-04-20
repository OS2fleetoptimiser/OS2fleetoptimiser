'use client';

import { usePatchGetLoginTime } from '@/components/hooks/userLoginTime';
import { useSession } from '@/lib/auth-client';
import PageTitle from '@/components/PageTitle';
import LandingPageKPIs from '@/app/(logged-in)/(landing-page)/KPIs';
import SimulationHighlights from '@/app/(logged-in)/(landing-page)/SimulationHighlights';
import { useGetSimulationHighlights, useGetUsageGraphData, useGetActivityGraphData, useGetLandingPageKPIs } from '@/components/hooks/useGetLandingPage';
import { Button, Skeleton } from '@mui/material';
import Link from 'next/link';
import LandingPageGraphs from '@/app/(logged-in)/(landing-page)/LandingPageGraphs';
import NoConnectionError from '@/app/(logged-in)/(landing-page)/NoConnectionError';
import NoSimulations from '@/app/(logged-in)/(landing-page)/NoSimulations';

export default function Home() {
    const { data: session } = useSession();
    // Better Auth uses 'id' instead of 'providerAccountId'
    const providerAccountId = session?.user?.id || 'developer';
    usePatchGetLoginTime(providerAccountId);
    const { data: kpiData, isPending: isKPIsLoading } = useGetLandingPageKPIs();
    const { data: latestSimulations, isPending: simulationsIsLoading } = useGetSimulationHighlights();
    const { data: usageGraphData, isPending: usageIsLoading } = useGetUsageGraphData();
    const { data: activityGraphData, isPending: activityIsLoading } = useGetActivityGraphData();

    return (
        <>
            <PageTitle
                title="Forside"
            />
            <div className="flex flex-col space-y-4">
                {!isKPIsLoading && kpiData && Object.keys(kpiData).length > 0 && <LandingPageKPIs data={kpiData} />}
                {!isKPIsLoading && (!kpiData || Object.keys(kpiData).length === 0) && <NoConnectionError />}
                {isKPIsLoading && (
                    <div className="flex flex-col md:flex-row md:flex-wrap md:gap-6 gap-4">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} variant="rounded" height={90} sx={{ flex: 1 }} />
                        ))}
                    </div>
                )}
                {simulationsIsLoading && (
                    <div className="w-full">
                        <Skeleton variant="text" width={200} sx={{ fontSize: '1.25rem', mb: 1 }} />
                        <Skeleton variant="rounded" height={220} />
                    </div>
                )}
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
                            <Button size="small" variant="outlined">
                                Simuleringshistorik
                            </Button>
                        </Link>
                    </div>
                )}
                {(usageIsLoading || activityIsLoading) && (!usageGraphData || !activityGraphData) && (
                    <div>
                        <Skeleton variant="text" width={260} sx={{ fontSize: '1.25rem', mb: 1 }} />
                        <div className="flex flex-col md:flex-row md:space-x-4">
                            <Skeleton variant="rounded" height={300} className="w-full md:w-1/2" />
                            <Skeleton variant="rounded" height={300} className="w-full md:w-1/2 mt-4 md:mt-0" />
                        </div>
                    </div>
                )}
                {usageGraphData && activityGraphData && usageGraphData.length > 0 && <LandingPageGraphs activityData={activityGraphData} usageData={usageGraphData} />}
                {/*  if we don't get this data, we won't get KPI data either, so we stick to one error message at the top  */}
            </div>
        </>
    );
}
