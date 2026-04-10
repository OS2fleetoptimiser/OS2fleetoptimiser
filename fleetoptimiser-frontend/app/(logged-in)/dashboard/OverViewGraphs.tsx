'use client';

import ApiError from '@/components/ApiError';
import useGetStatisticsOverview from '@/components/hooks/useGetStatisticsOverview';
import { Card, CircularProgress, Typography } from '@mui/material';
import dayjs from 'dayjs';
import React from 'react';
import DateLineGraph from './DateLineGraph';
import { DownloadableGraph } from '@/components/DownloadableGraph';
import { brand } from '@/theme/themePrimitives';

type Props = {
    startDate?: string;
    endDate?: string;
    locations?: number[];
    forvaltninger?: string[];
};

export default function OverViewGraphs({ endDate, forvaltninger, locations, startDate }: Props) {
    const emissionSeries = useGetStatisticsOverview({
        startPeriod: startDate ? dayjs(startDate) : dayjs().add(-7, 'day'),
        endPeriod: endDate ? dayjs(endDate) : dayjs(),
        dashboard: 'emission',
        locationIds: locations,
        forvaltninger: forvaltninger,
        selector: (data) => {
            return {
                ...data,
                id: 'emission',
            };
        },
    });

    const shareSeries = useGetStatisticsOverview({
        startPeriod: startDate ? dayjs(startDate) : dayjs().add(-7, 'day'),
        endPeriod: endDate ? dayjs(endDate) : dayjs(),
        dashboard: 'share',
        locationIds: locations,
        forvaltninger: forvaltninger,
        selector: (data) => {
            return {
                ...data,
                id: 'share',
            };
        },
    });
    const drivenSeries = useGetStatisticsOverview({
        startPeriod: startDate ? dayjs(startDate) : dayjs().add(-7, 'day'),
        endPeriod: endDate ? dayjs(endDate) : dayjs(),
        dashboard: 'driven',
        locationIds: locations,
        forvaltninger: forvaltninger,
        selector: (data) => {
            return {
                ...data,
                id: 'driven',
            };
        },
    });
    // forvaltninger irrelevant
    const fileStartDate = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().add(-7, 'day').format('YYYY-MM-DD');
    const fileEndDate = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
    const fileNameAppendix = `${fileStartDate}-${fileEndDate}-${locations?.length ?? 'alle'}_lokationer`;
    return (
        <div className="flex flex-col space-y-4">
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    CO2e udledning (Ton)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Grafen viser den samlede CO2e udledning over tid for de valgte lokationer.
                </Typography>
                {emissionSeries.isError && <ApiError retryFunction={emissionSeries.refetch}>Dashboard data kunne ikke hentes</ApiError>}
                {emissionSeries.isPending && (
                    <div className="p-10 flex justify-center">
                        <CircularProgress />
                    </div>
                )}
                {emissionSeries.data &&
                    (emissionSeries.data.data.length > 0 ? (
                        <div className="h-80">
                            <DownloadableGraph filename={`overblik_udledning_${fileNameAppendix}.png`}>
                                <DateLineGraph data={[emissionSeries.data]} yLabel={'Ton CO2e udledning'} color={brand[700]}></DateLineGraph>
                            </DownloadableGraph>
                        </div>
                    ) : (
                        <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                    ))}
            </Card>
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Procentvis kørt i elbil
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Grafen viser andelen af kørsel i elbiler over tid for de valgte lokationer.
                </Typography>
                {shareSeries.isError && <ApiError retryFunction={shareSeries.refetch}>Dashboard data kunne ikke hentes</ApiError>}
                {shareSeries.isPending && (
                    <div className="p-10 flex justify-center">
                        <CircularProgress />
                    </div>
                )}
                {shareSeries.data &&
                    (shareSeries.data.data.length > 0 ? (
                        <div className="h-80">
                            <DownloadableGraph filename={`overblik_fossilfri_${fileNameAppendix}.png`}>
                                <DateLineGraph data={[shareSeries.data]} yLabel={'Procentvis kørt i elbil'} color={brand[400]}></DateLineGraph>
                            </DownloadableGraph>
                        </div>
                    ) : (
                        <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                    ))}
            </Card>
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Kørte kilometer
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Grafen viser det samlede antal kørte kilometer over tid for de valgte lokationer.
                </Typography>
                {drivenSeries.isError && <ApiError retryFunction={drivenSeries.refetch}>Dashboard data kunne ikke hentes</ApiError>}
                {drivenSeries.isPending && (
                    <div className="p-10 flex justify-center">
                        <CircularProgress />
                    </div>
                )}
                {drivenSeries.data &&
                    (drivenSeries.data.data.length > 0 ? (
                        <div className="h-80">
                            <DownloadableGraph filename={`overblik_kørsel_${fileNameAppendix}.png`}>
                                <DateLineGraph data={[drivenSeries.data]} yLabel={'Kørte kilometer'} color={brand[200]}></DateLineGraph>
                            </DownloadableGraph>
                        </div>
                    ) : (
                        <p className="m-4">Der er ingen kørselsdata for de valgte filtre.</p>
                    ))}
            </Card>
        </div>
    );
}
