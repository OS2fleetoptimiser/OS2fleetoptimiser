'use client';

import { use } from 'react';
import CollectiveStatistics from './CollectiveStatistics';
import FilterHeader, { Filters } from './(filters)/FilterHeader';
import OverViewGraphs from './OverViewGraphs';
import {FilterHeaderWrapper} from "@/app/(logged-in)/dashboard/(filters)/FilterWrapper";

type Props = {
    searchParams: Promise<Filters>;
};

export default function DashboardOverview({ searchParams: searchParamsPromise }: Props) {
    const searchParams = use(searchParamsPromise);
    return (
        <>
            <FilterHeaderWrapper vehicleFilter={false} departmentFilter={false} shiftFilter={false}></FilterHeaderWrapper>
            <CollectiveStatistics
                start={searchParams.startdate}
                end={searchParams.enddate}
                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
            ></CollectiveStatistics>
            <OverViewGraphs
                startDate={searchParams.startdate}
                endDate={searchParams.enddate}
                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
            ></OverViewGraphs>
        </>
    );
}
