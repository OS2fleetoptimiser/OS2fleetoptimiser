import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { useMemo } from 'react';
import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import { ResponsiveBar } from '@nivo/bar';
import ToolTip from '@/components/ToolTip';
import { drivingBook } from '@/components/hooks/useSimulateFleet';

export type entry = {
    label: string;
    km: number;
    Cykel: number;
    'El-cykel': number;
    'El-bil': number;
    'Fossil-bil': number;
    'Ikke tildelt': number;
};

type props = {
    data: entry[];
};

type Colors = {
    [key: string]: string;
};

export const VehicleTripDistributionBar = ({ data }: props) => {
    const sumsY = data.map((bucket) => {
        const { km, ...counts } = bucket;
        return Object.values(counts).reduce((sum: number, val) => sum + (typeof val === 'number' ? val : 0), 0);
    });
    const yTicks = getYTicks(sumsY);
    const colors: Colors = { Cykel: '#40dd7f', 'El-cykel': '#ffbc1f', 'El-bil': '#109cf1', 'Fossil-bil': '#ff6760', 'Ikke tildelt': '#52575c' };
    return (
        <ResponsiveBar
            data={data.sort((a, b) => a.km - b.km)}
            keys={['Cykel', 'El-cykel', 'El-bil', 'Fossil-bil', 'Ikke tildelt']}
            indexBy="label"
            margin={{ top: 20, right: 130, bottom: 100, left: 60 }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={(e) => colors[e.id]}
            borderColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 35,
                legend: 'Turlængde',
                legendPosition: 'middle',
                legendOffset: 55,
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                legend: 'Antal ture',
                legendPosition: 'middle',
                legendOffset: -40,
                tickValues: yTicks,
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor="white"
            legends={[
                {
                    dataFrom: 'keys',
                    anchor: 'bottom-right',
                    direction: 'column',
                    justify: false,
                    translateX: 120,
                    translateY: 0,
                    itemsSpacing: 2,
                    itemWidth: 100,
                    itemHeight: 20,
                    itemDirection: 'left-to-right',
                    itemOpacity: 0.85,
                    symbolSize: 20,
                    effects: [
                        {
                            on: 'hover',
                            style: {
                                itemOpacity: 1,
                            },
                        },
                    ],
                },
            ]}
            tooltip={({ id, value, data }) => (
                <div className="bg-[#222] text-white p-2 rounded-md text-xs">
                    Turlængde: <span className="font-bold">{data.label}</span>
                    <br />
                    {id}: <span className="font-bold">{value} ture</span>
                </div>
            )}
            theme={{
                labels: { text: { fontWeight: 'bold', fontSize: '0.75rem' } },
            }}

        />
    );
};

export const VehicleTripDistribution = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const getTripsByType = (data: drivingBook[], dataType: 'simulation' | 'current') => {
        const bucketSize = 20;
        const numBuckets = 6;
        let buckets = Array.from({ length: numBuckets }, (_, i) => {
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
            let bucketIndex = distance < (numBuckets - 1) * bucketSize ? Math.floor(distance / bucketSize) : numBuckets - 1;
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
