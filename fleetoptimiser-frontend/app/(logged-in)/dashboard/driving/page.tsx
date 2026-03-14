'use client';

import { use } from 'react';
import AverageDrivingDashboard from './(AverageDriving)/AverageDrivingDashboard';
import DailyDrivingDashboard from './(DailyDriving)/DailyDrivingDashboard';
import MonthlyDrivingDashboard from './(MonthlyDriving)/MonthlyDrivingDashboard';
import AddFilter from '@/components/AddFilter';
import { Filters } from '../(filters)/FilterHeader';
import { FilterHeaderWrapper } from '@/app/(logged-in)/dashboard/(filters)/FilterWrapper';
import useGetSettings from '@/components/hooks/useGetSettings';
import { Card, CardContent, CircularProgress } from '@mui/material';
import PageTitle from '@/components/PageTitle';

type Props = {
    searchParams: Promise<Filters>;
};

export default function DrivingDashboard({ searchParams: searchParamsPromise }: Props) {
    const searchParams = use(searchParamsPromise);
    const { data: settings, isPending: isLoading, error } = useGetSettings();

    if (isLoading)
        return (
            <div className="p-10 flex justify-center">
                <CircularProgress />
            </div>
        );
    if (error) return <p>Fejl</p>;

    const availableShifts =
        settings?.shift_settings
            ?.find((loc: any) => loc.location_id === -1)
            ?.shifts.map((shift: any, i: number) => ({
                id: i,
                shift_start: shift.shift_start,
                shift_end: shift.shift_end,
                shift_break: shift.shift_break,
            })) || [];

    const enabled = searchParams.locations || searchParams.vehicles || searchParams.departments || searchParams.forvaltninger;

    return (
        <>
            <PageTitle title="Kørsel" />
            <FilterHeaderWrapper shiftFilter={false}></FilterHeaderWrapper>

            {!enabled && <AddFilter />}
            {enabled && (
                <div className="space-y-6">
                    <Card>
                        <CardContent>
                            <DailyDrivingDashboard
                                start={searchParams.startdate}
                                end={searchParams.enddate}
                                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
                                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                                departments={typeof searchParams.departments === 'string' ? [searchParams.departments] : searchParams.departments}
                                vehicles={typeof searchParams.vehicles === 'string' ? [+searchParams.vehicles] : searchParams.vehicles?.map((vehicle) => +vehicle)}
                                availableshifts={availableShifts}
                                shifts={typeof searchParams.shifts === 'string' ? [+searchParams.shifts] : searchParams.shifts?.map((shift) => +shift)}
                            ></DailyDrivingDashboard>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent>
                            <AverageDrivingDashboard
                                start={searchParams.startdate}
                                end={searchParams.enddate}
                                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
                                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                                departments={typeof searchParams.departments === 'string' ? [searchParams.departments] : searchParams.departments}
                                vehicles={typeof searchParams.vehicles === 'string' ? [+searchParams.vehicles] : searchParams.vehicles?.map((vehicle) => +vehicle)}
                                availableshifts={availableShifts}
                                shifts={typeof searchParams.shifts === 'string' ? [+searchParams.shifts] : searchParams.shifts?.map((shift) => +shift)}
                            ></AverageDrivingDashboard>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent>
                            <MonthlyDrivingDashboard
                                start={searchParams.startdate}
                                end={searchParams.enddate}
                                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
                                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                                departments={typeof searchParams.departments === 'string' ? [searchParams.departments] : searchParams.departments}
                                vehicles={typeof searchParams.vehicles === 'string' ? [+searchParams.vehicles] : searchParams.vehicles?.map((vehicle) => +vehicle)}
                                availableshifts={availableShifts}
                                shifts={typeof searchParams.shifts === 'string' ? [+searchParams.shifts] : searchParams.shifts?.map((shift) => +shift)}
                            ></MonthlyDrivingDashboard>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}
