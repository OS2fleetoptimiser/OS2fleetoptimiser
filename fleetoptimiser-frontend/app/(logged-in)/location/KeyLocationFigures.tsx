'use client';

import Typography from "@mui/material/Typography";
import { Card, CardContent } from "@mui/material";
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
                <div className="flex my-8 gap-4">
                    <Card className="flex-1">
                        <CardContent>
                            <Typography variant="subtitle2" className="mb-4">Højeste rundturspræcision</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: keyFigures.highest && keyFigures.highest.precision >= successThreshold ? 'success.main' : 'error.main' }}>{keyFigures.highest?.precision}%</Typography>
                            <p className="pb-2 mt-2 text-sm text-gray-500" title={keyFigures.highest?.address}>{keyFigures.highest?.address && keyFigures.highest?.address.length > 37 ? keyFigures.highest?.address.substring(0,30) + '...' : keyFigures.highest?.address}</p>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent>
                            <Typography variant="subtitle2" className="mb-4">Laveste rundturspræcision</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: keyFigures.lowest && keyFigures.lowest.precision >= successThreshold ? 'success.main' : 'error.main' }}>{keyFigures.lowest?.precision}%</Typography>
                            <p className="pb-2 mt-2 text-sm text-gray-500" title={keyFigures.lowest?.address}>{keyFigures.lowest?.address && keyFigures.lowest?.address.length > 37 ? keyFigures.lowest?.address.substring(0,30) + '...' : keyFigures.lowest?.address}</p>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardContent>
                            <Typography variant="subtitle2" className="mb-4">Gennemsnitlig rundturspræcision</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: keyFigures.average && keyFigures.average.precision >= successThreshold ? 'success.main' : 'error.main' }}>{keyFigures.average?.precision}%</Typography>
                            <p className="pb-2 mt-2 text-sm text-gray-500">Alle lokationer</p>
                        </CardContent>
                    </Card>
                </div>
            }
            {!data &&
                <div className="flex my-8 items-center">Ingen data</div>}
        </>
    )
}
