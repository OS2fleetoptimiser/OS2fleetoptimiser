import { LocationActivity, LocationUsage } from '@/components/hooks/useGetLandingPage';
import UsageGraph from '@/app/(logged-in)/(landing-page)/UsageGraph';
import ActivityHeatmap from '@/app/(logged-in)/(landing-page)/ActivityGraph';
import Link from 'next/link';
import { Button, Card, CardContent } from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import NoData from "@/app/(logged-in)/(landing-page)/NoData";
import PageTitle from '@/components/PageTitle';

export default function LandingPageGraphs({ usageData, activityData }: { usageData: LocationUsage[]; activityData: LocationActivity[] }) {
    const isWide = useMediaQuery({ minWidth: 1348 });
    const isMedium = useMediaQuery({ minWidth: 520, maxWidth: 767 });
    const showKeys = isWide || isMedium;

    const sortedUsageData = usageData
        .filter((locationData) => locationData.location_usage !== 0)
        .sort((a, b) => (a.usage_ratio - b.usage_ratio))
        .slice(0, 5);
    const sortedActivityData = activityData
        .filter((locationData) => locationData.total_activity !== 0)
        .sort((a, b) => a.total_average_activity - b.total_average_activity)
        .slice(0, 5)
        .map((locationData) => ({
            id: locationData.location_id.toString(),
            address: locationData.address,
            locationId: locationData.location_id.toString(),
            data: locationData.weeks.map((week) => ({
                x: week.week_name,
                y: week.average_activity,
                start_date: week.start_date,
                end_date: week.end_date,
            })),
        }));

    return (
        <div>
            <PageTitle level="section" title="Udnyttelsesgrad og aktivitet" />
            <div className="flex flex-col md:flex-row md:space-x-4">
                <div className="w-full md:w-1/2">
                    <Card variant="outlined">
                        <CardContent>
                            {sortedUsageData.length > 0 ? <UsageGraph data={sortedUsageData} showKeys={showKeys}/> : <NoData/>}
                            <div key="buttongroup" className="flex flex-row items-center space-x-4">
                                <Link href={'/dashboard/availability'}>
                                    <Button size="small" variant="outlined">
                                        Ledighedsgraf
                                    </Button>
                                </Link>
                                <Link href={'/dashboard/timeactivity'}>
                                    <Button size="small" variant="outlined">
                                        Tidsaktivitet
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="w-full md:w-1/2 mt-16 md:mt-0">
                    <Card variant="outlined">
                        <CardContent>
                            {sortedActivityData.length > 0 ? <ActivityHeatmap data={sortedActivityData} showKeys={showKeys}/> : <NoData/>}
                            <div key="buttongroup" className="flex flex-row items-center space-x-4">
                                <Link href={'/dashboard/activity'}>
                                    <Button size="small" variant="outlined">
                                        Køretøjsaktivitet
                                    </Button>
                                </Link>
                                <Link href={'/dashboard/driving'}>
                                    <Button size="small" variant="outlined">
                                        Kørselsgrafer
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
