'use client';
import { use } from 'react';
import TripSegmentsDashboard from './TripSegmentsDashboard';
import { Filters } from '../(filters)/FilterHeader';
import AddFilter from "@/components/AddFilter";
import {FilterHeaderWrapper} from "@/app/(logged-in)/dashboard/(filters)/FilterWrapper";
import useGetSettings from "@/components/hooks/useGetSettings";
import {Skeleton} from "@mui/material";
import PageTitle from '@/components/PageTitle';


type Props = {
    searchParams: Promise<Filters>;
};

export default function TripSegments({ searchParams: searchParamsPromise }: Props) {
    const searchParams = use(searchParamsPromise);
      const { data: settings, isPending: isLoading, error } = useGetSettings();

    if (isLoading)
        return (
            <>
                <PageTitle
                    title="Turoverblik"
                    subtitle="Viser afsluttede rundture startet og sluttet på samme lokation. Kun kvalificerede rundture ud fra de indtastede parametre vises, hvilket kan betyde, at ikke alle kilometer fra Køretøjsaktivitet fremgår."
                />
                <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={400} />
            </>
        );
    if (error) return<p>Fejl</p>;

    const availableShifts = settings?.shift_settings
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
            <PageTitle
                title="Turoverblik"
                subtitle="Viser afsluttede rundture startet og sluttet på samme lokation. Kun kvalificerede rundture ud fra de indtastede parametre vises, hvilket kan betyde, at ikke alle kilometer fra Køretøjsaktivitet fremgår."
            />
            <FilterHeaderWrapper availableshifts={availableShifts}></FilterHeaderWrapper>

            {!enabled && <AddFilter />}

            {enabled && <TripSegmentsDashboard
                start={searchParams.startdate}
                end={searchParams.enddate}
                locations={typeof searchParams.locations === 'string' ? [+searchParams.locations] : searchParams.locations?.map((loc) => +loc)}
                forvaltninger={typeof searchParams.forvaltninger === 'string' ? [searchParams.forvaltninger] : searchParams.forvaltninger}
                departments={typeof searchParams.departments === 'string' ? [searchParams.departments] : searchParams.departments}
                vehicles={typeof searchParams.vehicles === 'string' ? [+searchParams.vehicles] : searchParams.vehicles?.map((vehicle) => +vehicle)}
                availableshifts={availableShifts}
                shifts={typeof searchParams.shifts === 'string' ? [+searchParams.shifts] : searchParams.shifts?.map((shift) => +shift)}
            ></TripSegmentsDashboard>}
        </>
    );
}
