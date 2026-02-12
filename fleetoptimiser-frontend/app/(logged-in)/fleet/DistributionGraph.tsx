import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import { ResponsiveBar } from '@nivo/bar';

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
                grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
            }}
        />
    );
};
