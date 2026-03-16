'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { ExtendedLocationInformation } from '@/components/hooks/useGetLocationPrecision';

type PrecisionCard = {
  precision: number;
  address: string;
};

type AverageCard = {
  roundtrips_km: number;
  km: number;
  precision: number;
};

type KeyFigures = {
  highest?: PrecisionCard;
  lowest?: PrecisionCard;
  average?: AverageCard;
};

type Props = {
  data?: ExtendedLocationInformation[];
};

const successThreshold = 80;

const PrecisionKPICard = ({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) => {
  const numValue = parseFloat(value);
  const isGood = !isNaN(numValue) && numValue >= successThreshold;
  return (
    <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
      <CardContent>
        <Typography component="h2" variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        <Typography
          variant="h4"
          component="p"
          sx={{ color: isGood ? 'success.main' : 'error.main' }}
        >
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} title={subtitle}>
          {subtitle.length > 37 ? subtitle.substring(0, 30) + '...' : subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
};

export const KeyLocationFigures = ({ data }: Props) => {
  const keyFigures = data?.reduce(
    (acc, locationData) => {
      const totalLocationKm = locationData.km;
      if (totalLocationKm === 0) {
        return acc;
      }
      const locationRoundtrips = locationData.roundtrip_km;
      const locationPrecision = locationData.precision;
      const locationAddress = locationData.address;
      if (!acc.lowest || locationPrecision < acc.lowest.precision) {
        acc.lowest = {
          precision: Math.round(locationPrecision),
          address: locationAddress,
        };
      }
      if (!acc.highest || locationPrecision > acc.highest.precision) {
        acc.highest = {
          precision: Math.round(locationPrecision),
          address: locationAddress,
        };
      }
      if (!acc.average) {
        acc.average = {
          roundtrips_km: locationRoundtrips,
          km: totalLocationKm,
          precision: Math.round(locationRoundtrips / totalLocationKm),
        };
      } else {
        const addedRoundtrips = acc.average.roundtrips_km + locationRoundtrips;
        const addedTotal = acc.average.km + totalLocationKm;
        acc.average = {
          roundtrips_km: addedRoundtrips,
          km: addedTotal,
          precision: Math.round((addedRoundtrips / addedTotal) * 100),
        };
      }

      return acc;
    },
    {} as KeyFigures
  );

  return (
    <>
      {data && keyFigures && (
        <div className="flex my-4 gap-2">
          <PrecisionKPICard
            title="Højeste rundturspræcision"
            value={`${keyFigures.highest?.precision}%`}
            subtitle={keyFigures.highest?.address ?? ''}
          />
          <PrecisionKPICard
            title="Laveste rundturspræcision"
            value={`${keyFigures.lowest?.precision}%`}
            subtitle={keyFigures.lowest?.address ?? ''}
          />
          <PrecisionKPICard
            title="Gennemsnitlig rundturspræcision"
            value={`${keyFigures.average?.precision}%`}
            subtitle="Alle lokationer"
          />
        </div>
      )}
      {!data && (
        <div className="flex my-4 items-center">Ingen data</div>
      )}
    </>
  );
};
