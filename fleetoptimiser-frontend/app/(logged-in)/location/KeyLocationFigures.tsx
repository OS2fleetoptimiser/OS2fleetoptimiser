'use client';

import Typography from "@mui/material/Typography";
import { ExtendedLocationInformation } from "@/components/hooks/useGetLocationPrecision";

type PrecisionCard = {
    precision: number;
    address: string;
}

type AverageCard = {
    roundtrips_km: number;
    km: number;
    precision: number;
}

type KeyFigures = {
    highest?: PrecisionCard;
    lowest?: PrecisionCard;
    average?: AverageCard;
}

type Props = {
    data?: ExtendedLocationInformation[];
}

export const KeyLocationFigures = ({ data }: Props) => {
    const successThreshold = 80

    const keyFigures = data?.reduce((acc, locationData) => {
        const totalLocationKm = locationData.km
        if (totalLocationKm === 0){
            return acc
        }
        const locationRoundtrips = locationData.roundtrip_km
        const locationPrecision = locationData.precision
        const locationAddress = locationData.address
        if (!acc.lowest || locationPrecision < acc.lowest.precision) {
            acc.lowest = { precision: Math.round(locationPrecision), address: locationAddress}
        }
        if (!acc.highest || locationPrecision > acc.highest.precision) {
            acc.highest = { precision: Math.round(locationPrecision), address: locationAddress}
        }
        if (!acc.average){
            acc.average = { roundtrips_km: locationRoundtrips, km: totalLocationKm, precision: Math.round(locationRoundtrips / totalLocationKm) }
        } else {
            const addedRoundtrips = acc.average.roundtrips_km + locationRoundtrips
            const addedTotal = acc.average.km + totalLocationKm
            acc.average = { roundtrips_km: addedRoundtrips, km: addedTotal, precision: Math.round(addedRoundtrips / addedTotal * 100)}
        }

        return acc;
        }, {} as KeyFigures)

    return (
        <>
            {data && keyFigures &&
                <div className="flex my-8 items-center">
                    <div className="bg-white custom-nav p-4 w-68">
                        <Typography variant="h4" className="mb-4">Højeste rundturspræcision</Typography>
                        <Typography variant="h2" className={keyFigures.highest && keyFigures.highest.precision >= successThreshold ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{keyFigures.highest?.precision}%</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500" title={keyFigures.highest?.address}>{keyFigures.highest?.address && keyFigures.highest?.address.length > 37 ? keyFigures.highest?.address.substring(0,30) + '...' : keyFigures.highest?.address}</p>

                    </div>
                    <div className="bg-white custom-nav mx-12 p-4 w-68">
                        <Typography variant="h4" className="mb-4">Laveste rundturspræcision</Typography>
                        <Typography variant="h2" className={keyFigures.lowest && keyFigures.lowest.precision >= successThreshold ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{keyFigures.lowest?.precision}%</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500" title={keyFigures.lowest?.address}>{keyFigures.lowest?.address && keyFigures.lowest?.address.length > 37 ? keyFigures.lowest?.address.substring(0,30) + '...' : keyFigures.lowest?.address}</p>
                    </div>
                    <div className="bg-white custom-nav p-4 w-76">
                        <Typography variant="h4" className="mb-4">Gennemsnitlig rundturspræcision</Typography>
                        <Typography variant="h2" className={keyFigures.average && keyFigures.average.precision >= successThreshold ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{keyFigures.average?.precision}%</Typography>
                        <p className="pb-2 mt-2 text-sm text-gray-500">Alle lokationer</p>
                    </div>
                </div>
            }
            {!data &&
                <div className="flex my-8 items-center">Ingen data</div>}
        </>
    )
}
