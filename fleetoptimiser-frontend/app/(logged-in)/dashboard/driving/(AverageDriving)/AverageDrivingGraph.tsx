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

    const getTspanGroups = (value: any, data: dataPoint[]) => {
        if (!showValuesOnAxis) {
            return null;
        }

        let plate = value; // Assuming value is directly the plate string
        let department = data.find((d) => d.plate === value)?.department || '';
        if (typeof department !== 'string') {
            department = '';
        }
        let departmentWords = department.split(' ');

        let children: JSX.Element[] = [];

        children.push(
            <tspan
                x={0}
                dy={15}
                fontSize="14"
                fontFamily="'Roboto', 'Helvetica', 'Arial', sans-serif"
                // fontWeight="500"
                key="plate"
            >
                {plate}
            </tspan>
        );

        departmentWords.forEach((word: any, index: number) => {
            children.push(
                <tspan x={-2} dy={index === 0 ? '10' : '10'} fontFamily="'Roboto', 'Helvetica', 'Arial', sans-serif" fontSize="9" key={`department-${index}`}>
                    {word}
                </tspan>
            );
        });

        return children;
    };

    let sorted = data.sort((a, b) => {
        let aSum = 0;
        let bSum = 0;
        keys.forEach((k) => {
            aSum += a[k] as number;
            bSum += b[k] as number;
        });

        return bSum - aSum;
    });

    return (
        <ResponsiveBar
            data={sorted}
            keys={keys}
            indexBy="plate"
            margin={{ top: 50, right: 210, bottom: 90, left: 60 }}
            padding={0.3}
            colors={getColors}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            tooltip={(data) => {
                return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs">
                        <p>{data.id}</p>
                        <p>{`Køretøj: ${data.data.plate} ${data.data.department}`}</p>
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
                format: showValuesOnAxis ? undefined : () => '', // Empty string if showValuesOnAxis is false
                renderTick: ({ opacity, textAnchor, x, y, value }) => {
                    if (data.length > 26) {
                        return <></>;
                    }
                    return (
                        <g transform={`translate(${x},${y})`} style={{ opacity }}>
                            <text textAnchor={textAnchor} transform="rotate(45)" fontSize={10}>
                                {getTspanGroups(value, data)}
                            </text>
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

export default AverageDrivingGraph;
