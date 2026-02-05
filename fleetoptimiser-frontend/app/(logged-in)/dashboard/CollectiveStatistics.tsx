'use client';

import { useGetSummedStatistics } from '@/components/hooks/useGetSummedStatistics';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import Typography from "@mui/material/Typography";

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
                <div className="flex my-8 items-center">
                    <div className="bg-white custom-nav p-4 w-68">
                        <Typography variant="h4" className="mb-4">Total kørte kilometer</Typography>
                        <Typography variant="h2" className="text-blue-500 font-bold">{summedStatistics.data.total_driven.toLocaleString()} km</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500">{`fra ${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} til ${dayjs(
                            summedStatistics.data.last_date
                        ).format('DD-MM-YYYY')}`}</p>

                    </div>
                    <div className="bg-white custom-nav mx-12 p-4 w-68">
                        <Typography variant="h4" className="mb-4">Total ton CO2e udledning</Typography>
                        <Typography variant="h2" className="text-blue-500 font-bold">{(+summedStatistics.data.total_emission.toPrecision(4)).toLocaleString()} Ton CO2e</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500">{`fra ${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} til ${dayjs(
                            summedStatistics.data.last_date
                        ).format('DD-MM-YYYY')}`}</p>
                    </div>
                    <div className="bg-white custom-nav p-4 w-68">
                        <Typography variant="h4" className="mb-4">Andel kørt i Elbil</Typography>
                        <Typography variant="h2" className="font-bold text-blue-500">{summedStatistics.data.share_carbon_neutral}%</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500">{`fra ${dayjs(summedStatistics.data.first_date).format('DD-MM-YYYY')} til ${dayjs(
                            summedStatistics.data.last_date
                        ).format('DD-MM-YYYY')}`}</p>
                    </div>
                </div>
            )}
        </>
    );
};

export default CollectiveStatistics;
