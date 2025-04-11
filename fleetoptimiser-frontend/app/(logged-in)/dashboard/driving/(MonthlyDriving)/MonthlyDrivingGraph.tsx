import { ResponsiveBar } from '@nivo/bar';

type key = {
    monthYear: string;
};

type kvPairs = {
    [key: string]: number;
};

type dataPoint = key & kvPairs;

const MonthlyDrivingGraph = ({ data, colorMapper }: { data: dataPoint[]; colorMapper: (s: string) => string }) => {
    const getColors = (bar: any) => {
        return colorMapper(bar.id);
    };
    let keys = data.length > 0 ? Object.keys(data[0]) : [];
    keys.splice(
        keys.findIndex((k) => k === 'monthYear'),
        1
    );

    return (
        <ResponsiveBar
            data={data}
            keys={keys}
            indexBy="monthYear"
            margin={{ top: 50, right: 230, bottom: 50, left: 80 }}
            padding={0.3}
            colors={getColors}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            valueFormat={(value) => (+value.toFixed(2)).toLocaleString() + ' km'}
            tooltip={(data) => {
                return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs">
                        <p>{data.id}</p>
                        <p>{`År-måned: ${data.data.monthYear}`}</p>
                        <p>{`${data.value.toFixed(1)} km`}</p>
                    </div>
                );
            }}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Måned',
                legendPosition: 'middle',
                legendOffset: 32,
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Kilometer',
                legendPosition: 'middle',
                legendOffset: -60,
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
            }}
            theme={{
                grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
            }}
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
        />
    );
};

export default MonthlyDrivingGraph;
