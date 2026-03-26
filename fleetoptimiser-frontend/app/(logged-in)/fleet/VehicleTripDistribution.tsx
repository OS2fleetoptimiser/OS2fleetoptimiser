import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { useMemo } from 'react';
import { drivingBook } from '@/components/hooks/useSimulateFleet';
import {VehicleTripDistributionBar} from "@/app/(logged-in)/fleet/DistributionGraph";
import { Card, Typography } from '@mui/material';

export const VehicleTripDistribution = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const getTripsByType = (data: drivingBook[], dataType: 'simulation' | 'current') => {
        const bucketSize = 20;
        const numBuckets = 6;
        const buckets = Array.from({ length: numBuckets }, (_, i) => {
            if (i < numBuckets - 1) {
                return {
                    label: `${i * bucketSize}-${(i + 1) * bucketSize} km`,
                    Cykel: 0,
                    'El-cykel': 0,
                    'El-bil': 0,
                    'Fossil-bil': 0,
                    'Ikke tildelt': 0,
                    km: i * bucketSize,
                };
            } else {
                return {
                    label: `${(numBuckets - 1) * bucketSize}+ km`,
                    Cykel: 0,
                    'El-cykel': 0,
                    'El-bil': 0,
                    'Fossil-bil': 0,
                    'Ikke tildelt': 0,
                    km: i * bucketSize,
                };
            }
        });

        data.forEach((trip) => {
            const distance = trip.distance;
            const bucketIndex = distance < (numBuckets - 1) * bucketSize ? Math.floor(distance / bucketSize) : numBuckets - 1;
            const type = dataType === 'simulation' ? trip.simulation_type : trip.current_type;
            switch (type) {
                case 1:
                    buckets[bucketIndex].Cykel++;
                    break;
                case 2:
                    buckets[bucketIndex]['El-cykel']++;
                    break;
                case 3:
                    buckets[bucketIndex]['El-bil']++;
                    break;
                case 4:
                    buckets[bucketIndex]['Fossil-bil']++;
                    break;
                default:
                    buckets[bucketIndex]['Ikke tildelt']++;
                    break;
            }
        });

        return buckets;
    };

    const currentTrips = useMemo(() => getTripsByType(simulationResults.drivingBook, 'current'), [simulationResults.drivingBook]);
    const simulationTrips = useMemo(() => getTripsByType(simulationResults.drivingBook, 'simulation'), [simulationResults.drivingBook]);

    return (
        <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6">
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Nuværende turfordeling på køretøjstype
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Fordelingen af ture på køretøjstype for den nuværende pulje (faktisk kørsel) i datoperioden. Grafen viser, hvor mange ture af forskellige
                    længder der er kørt af hhv. cykler, elcykler, elbiler og fossilbiler.
                </Typography>
                <div className="h-80">
                    <VehicleTripDistributionBar data={currentTrips} />
                </div>
            </Card>
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Simuleret turfordeling på køretøjstype
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Fordelingen af ture på køretøjstype for den simulerede pulje i datoperioden. Grafen viser, hvor mange ture af forskellige længder
                    der er kørt af hhv. cykler, elcykler, elbiler og fossilbiler.
                </Typography>
                <div className="h-80">
                    <VehicleTripDistributionBar data={simulationTrips} />
                </div>
            </Card>
        </div>
    );
};
