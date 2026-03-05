'use client';

import { use } from 'react';
import { Filters } from '../(filters)/FilterHeader';
import AvailabilityChart from './AvailabilityChart';
import AddFilter from "@/components/AddFilter";
import {FilterHeaderWrapper} from "@/app/(logged-in)/dashboard/(filters)/FilterWrapper";


type Props = {
    searchParams: Promise<Filters>;
};

export default function Availability({ searchParams: searchParamsPromise }: Props) {
    const searchParams = use(searchParamsPromise);
    const timeFrame =
        searchParams.enddate && searchParams.startdate
            ? (new Date(searchParams.enddate).getTime() - new Date(searchParams.startdate).getTime()) / 1000 / 60 / 60 / 24
            : undefined;
    const enabled = searchParams.locations || searchParams.vehicles || searchParams.departments || searchParams.forvaltninger;

    return (
        <>
            <FilterHeaderWrapper shiftFilter={false}></FilterHeaderWrapper>
            {timeFrame && timeFrame >= 8 && (
                <div className="p-8">
                    <p>Af performance årsager kan der maksimalt udregnes kapacitet for 1 uges data.</p>
                </div>
            )}
            {!enabled && <AddFilter />}

            {enabled && (timeFrame === undefined || timeFrame <= 8) && (
                <AvailabilityChart
                    start={searchParams.startdate}
                    end={searchParams.enddate}
                    locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
                    forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                    departments={typeof searchParams.departments === 'string' ? [searchParams.departments] : searchParams.departments}
                    vehicles={typeof searchParams.vehicles === 'string' ? [+searchParams.vehicles] : searchParams.vehicles?.map((vehicle) => +vehicle)}
                ></AvailabilityChart>
            )}
        </>
    );
}
