'use client';

import { useGetSummedStatistics } from '@/components/hooks/useGetSummedStatistics';
import { Card, CircularProgress, Typography } from '@mui/material';
import dayjs from 'dayjs';

type Props = {
    start?: string;
    end?: string;
    locations?: number[];
    forvaltninger?: string[];
};

export const CollectiveStatistics = ({ start, end, forvaltninger, locations }: Props) => {
    const summedStatistics = useGetSummedStatistics({
        start: start ? dayjs(start) : dayjs().add(-7, 'day'),
        end: end ? dayjs(end) : dayjs(),
        locations: locations,
        forvaltninger: forvaltninger,
    });

    return (
        <>
            {summedStatistics.isPending && (
                <div className="p-10 flex justify-center">
                    <CircularProgress />
                </div>
            )}
            {summedStatistics.data && (
                <div className="flex gap-4 mb-4">
                    <Card sx={{ p: 2, flex: 1 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Total kørte kilometer
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {summedStatistics.data.total_driven.toLocaleString()} km
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {`${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} - ${dayjs(summedStatistics.data.last_date).format('DD-MM-YYYY')}`}
                        </Typography>
                    </Card>
                    <Card sx={{ p: 2, flex: 1 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Total ton CO2e udledning
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {(+summedStatistics.data.total_emission.toPrecision(4)).toLocaleString()} Ton CO2e
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {`${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} - ${dayjs(summedStatistics.data.last_date).format('DD-MM-YYYY')}`}
                        </Typography>
                    </Card>
                    <Card sx={{ p: 2, flex: 1 }}>
                        <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                            Andel kørt i elbil
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {summedStatistics.data.share_carbon_neutral}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {`${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} - ${dayjs(summedStatistics.data.last_date).format('DD-MM-YYYY')}`}
                        </Typography>
                    </Card>
                </div>
            )}
        </>
    );
};

export default CollectiveStatistics;
