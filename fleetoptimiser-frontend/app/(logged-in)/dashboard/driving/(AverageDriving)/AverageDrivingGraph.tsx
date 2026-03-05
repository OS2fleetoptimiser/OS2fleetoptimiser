import { ResponsiveBar } from '@nivo/bar';

type key = {
    plate: string;
};

type kvPairs = {
    [key: string]: number;
};

type dataPoint = key & kvPairs;

const AverageDrivingGraph = ({ data, keys, colorMapper }: { data: dataPoint[]; keys: string[]; colorMapper: (s: string) => string }) => {
    // Used to fix, so it doesn't show the labels on the bottom axis if there is more than 60
    const showValuesOnAxis = data.length <= 60;
    const getColors = (bar: any) => {
        return colorMapper(bar.id);
    };

    const sorted = data.sort((a, b) => {
        let aSum = 0;
        let bSum = 0;
        keys.forEach((k) => {
            aSum += a[k] as number;
            bSum += b[k] as number;
        });

        return bSum - aSum;
    });

    const datumLookup = data.reduce(
        (acc, item) => {
            acc[item.vehicle_id.toString()] = item;
            return acc;
        },
        {} as { [key: string]: { plate?: string; department?: string } }
    );
    return (
        <ResponsiveBar
            data={sorted}
            keys={keys}
            indexBy="vehicle_id"
            margin={{ top: 50, right: 210, bottom: 90, left: 60 }}
            padding={0.3}
            colors={getColors}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            tooltip={(data) => {
                return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs">
                        <p>{data.id}</p>
                        <p>{`Køretøj: ${data.data.plate ?? 'Ingen reg.nr.'} ${data.data.department ?? ''}`}</p>
                        <p>{`Gmns kørsel: ${data.value.toFixed(1)}`}</p>
                    </div>
                );
            }}
            valueFormat={(value) => (+value.toFixed(2)).toLocaleString() + ' km'}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 45,
                legend: 'Køretøjer',
                legendPosition: 'middle',
                legendOffset: 80,
                format: showValuesOnAxis ? undefined : () => '',
                renderTick: ({ opacity, textAnchor, x, y, value }) => {
                    const datum = datumLookup[value.toString()];
                    if (!datum || data.length > 27) return <></>;
                    const { plate, department } = datum;
                    const anchor = textAnchor as "start" | "middle" | "end" | "inherit";
                    return (
                        <g transform={`translate(${x},${y})`} style={{ opacity }}>
                            {plate ? (
                                <text fontSize="12" textAnchor={anchor} transform="rotate(45)">
                                    <tspan x={2} dy={7}>
                                        {plate}
                                    </tspan>
                                </text>
                            ) : (
                                <text fontSize="12" textAnchor={anchor} transform="rotate(45)">
                                    <tspan x={2} dy={7}>
                                        Ingen reg.nr.
                                    </tspan>
                                </text>
                            )}
                            {department && (
                                <text fontSize="10" textAnchor={anchor} transform="rotate(45)">
                                    <tspan x={-10} dy={20}>
                                        {department}
                                    </tspan>
                                </text>
                            )}
                        </g>
                    );
                },
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Gennemsnitlige kørsel pr. dag pr. vagtlag',
                legendPosition: 'middle',
                legendOffset: -40,
            }}
            labelSkipWidth={40}
            labelSkipHeight={20}
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

export default AverageDrivingGraph;
