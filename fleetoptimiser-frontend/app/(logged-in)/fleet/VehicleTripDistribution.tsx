import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { useMemo } from 'react';
import ToolTip from '@/components/ToolTip';
import { drivingBook } from '@/components/hooks/useSimulateFleet';
import {VehicleTripDistributionBar} from "@/app/(logged-in)/fleet/DistributionGraph";

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
        <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6 h-96">
            <div className="p-4 pt-2 bg-white border border-gray-100 rounded-md shadow-sm w-full h-96">
                <div className="flex items-center">
                    <span className="text-sm font-semibold">Nuværende turfordeling på køretøjstype</span>
                    <ToolTip>
                        Fordelingen af ture på køretøjstype for den nuværende pulje (faktiske kørsel) i datoperioden. Det vises hvor mange ture i forskellige
                        længder, der er kørt af hhv. cykler, elcykler, elbiler og fossilbiler. Kør musen over for en bar for at se det specifikke antal.
                    </ToolTip>
                </div>
                <VehicleTripDistributionBar data={currentTrips} />
            </div>
            <div className="p-4 pt-2 bg-white border border-gray-100 rounded-md shadow-sm w-full h-96">
                <div className="flex items-center">
                    <span className="text-sm font-semibold">Simuleret turfordeling på køretøjstype</span>
                    <ToolTip>
                        Fordelingen af ture på køretøjstype for den simulerede pulje i datoperioden. Det vises hvor mange ture i forskellige længder, der er
                        kørt af hhv. cykler, elcykler, elbiler og fossilbiler. Kør musen over for en bar for at se det specifikke antal.
                    </ToolTip>
                </div>
                <VehicleTripDistributionBar data={simulationTrips} />
            </div>
        </div>
    );
};
