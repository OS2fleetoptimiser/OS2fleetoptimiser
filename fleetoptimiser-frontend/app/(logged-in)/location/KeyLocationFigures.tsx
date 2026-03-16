'use client';

import Box from '@mui/material/Box';
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

export const PRECISION_THRESHOLD = 80;

const BAR_WIDTH = 280;

const MetricRow = ({
  label,
  value,
  subtitle,
  showThresholdLabel = false,
}: {
  label: string;
  value: number;
  subtitle: string;
  showThresholdLabel?: boolean;
}) => {
  const aboveThreshold = value >= PRECISION_THRESHOLD;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', width: 80, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="h6" component="span" sx={{ fontWeight: 700, width: 48, flexShrink: 0 }}>
        {value}%
      </Typography>
      <Box sx={{ width: BAR_WIDTH, flexShrink: 0, position: 'relative', height: 6, overflow: 'visible' }}>
        {/* Track */}
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: 3, backgroundColor: 'grey.200' }} />
        {/* Fill */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${Math.min(value, 100)}%`,
            borderRadius: 3,
            backgroundColor: aboveThreshold ? 'success.main' : 'primary.main',
            opacity: aboveThreshold ? 0.7 : Math.max(0.25, value / 100),
          }}
        />
        {/* Threshold line -- extends beyond bar to connect across rows */}
        <Box
          sx={{
            position: 'absolute',
            left: `${PRECISION_THRESHOLD}%`,
            top: -13,
            bottom: -13,
            width: 0,
            borderLeft: '1.5px dashed',
            borderColor: 'text.disabled',
            zIndex: 1,
          }}
        />
        {showThresholdLabel && (
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${PRECISION_THRESHOLD}%`,
              top: -22,
              transform: 'translate(-50%, -100%)',
              color: 'text.disabled',
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {PRECISION_THRESHOLD}%
          </Typography>
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}
        title={subtitle}
      >
        {subtitle}
      </Typography>
    </Box>
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

  if (!data) {
    return <div className="flex my-4 items-center">Ingen data</div>;
  }

  if (!keyFigures?.lowest || !keyFigures?.highest || !keyFigures?.average) {
    return null;
  }

  const { lowest, highest, average } = keyFigures;

  return (
    <Card variant="outlined" sx={{ my: 2, width: 'fit-content' }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Rundturspræcision
        </Typography>
        <MetricRow label="Højeste" value={highest.precision} subtitle={highest.address} showThresholdLabel />
        <MetricRow label="Gennemsnit" value={average.precision} subtitle="Alle lokationer" />
        <MetricRow label="Laveste" value={lowest.precision} subtitle={lowest.address} />
      </CardContent>
    </Card>
  );
};
