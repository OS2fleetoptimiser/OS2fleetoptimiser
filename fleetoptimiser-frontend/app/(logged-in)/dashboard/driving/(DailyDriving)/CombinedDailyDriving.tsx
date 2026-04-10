'use client';

import { ResponsiveLine } from '@nivo/line';
import { nivoTheme } from '@/theme/nivoTheme';

export type Entry = {
    x: string;
    y: number;
};

export type LineData = {
    id: string;
    uniqueCars: number;
    data: Entry[];
};

type Props = {
    data: LineData[];
    header?: string;
    colorMapper: (s: string) => string;
};

const CombinedDailyDrivingGraph = ({ data, colorMapper }: Props) => {
    const getAveragePerSeries = (series: LineData): number => series.data.reduce((sum, point) => sum + point.y, 0) / series.data.length;

    return (
        <div className="h-full">
                <ResponsiveLine
                    data={data}
                    tooltip={({ point }) => {
                        return (
                            <div className="bg-gray-900 text-white p-2 rounded text-xs">
                                <div>
                                    <span className="font-bold">{point.seriesId}</span>
                                </div>
                                <div>{point.data.xFormatted}</div>
                                <div>
                                    <span className="font-semibold">{Number(point.data.y).toFixed(1).toLocaleString()} km</span>
                                </div>
                            </div>
                        );
                    }}
                    margin={{ top: 50, right: 210, bottom: 90, left: 80 }}
                    colors={(bar: LineData) =>
                        colorMapper(bar.id)
                    }
                    xScale={{
                        type: 'time',
                        format: '%Y-%m-%d',
                        useUTC: false,
                        precision: 'day',
                    }}
                    xFormat="time:%Y-%m-%d"
                    yScale={{
                        type: 'linear',
                        stacked: false,
                    }}
                    axisLeft={{
                        legend: 'Kilometer',
                        legendOffset: -60,
                        legendPosition: 'middle',
                    }}
                    axisBottom={{
                        format: '%b %d',
                        tickValues: 5,
                        legend: 'Dato',
                        legendOffset: 40,
                        legendPosition: 'middle',
                    }}
                    enablePointLabel={false}
                    pointSize={1}
                    theme={nivoTheme}
                    pointBorderWidth={1}
                    pointBorderColor={{
                        from: 'color',
                        modifiers: [['darker', 0.3]],
                    }}
                    useMesh={true}
                    enableSlices={false}
                    enableArea={false}
                    legends={[
                        {
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
        </div>
    );
};

export default CombinedDailyDrivingGraph;
