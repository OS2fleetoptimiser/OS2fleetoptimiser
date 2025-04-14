import { ResponsiveLine } from '@nivo/line';
import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import React from 'react';

type dataPoint = {
    x: string;
    y: number;
};

type props = {
    data: {
        id: string;
        data: dataPoint[];
    }[];
    yLabel: string;
    color: string;
};

const DateLineGraph = ({ data, yLabel, color }: props) => {
    const dataType = data[0].id;
    const yTicks = getYTicks(
        data.flatMap((series) => series.data.map((point) => (dataType === 'emission' ? Number(point.y.toFixed(3)) : Number(point.y.toFixed()))))
    );
    const metrics: Record<string, string> = {
        emission: 'Ton CO2e',
        share: '% fossilfri',
        driven: 'km',
    };
    return (
        <ResponsiveLine
            tooltip={({ point }) => {
                return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs">
                        <span className="font-bold">
                            {point.data.yFormatted} {metrics[dataType] || ''}
                        </span>
                        <br />
                        Dato: {point.data.xFormatted}
                    </div>
                );
            }}
            margin={{ top: 40, right: 20, bottom: 70, left: 80 }}
            animate={true}
            data={data}
            colors={[color]}
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
            yFormat={(value) => {
                const num = value as number;
                return num.toLocaleString('da-DK', {
                    maximumFractionDigits: dataType === 'emission' ? 3 : 0,
                });
            }}
            axisLeft={{
                legend: yLabel,
                legendOffset: -60,
                legendPosition: 'middle',
                tickValues: yTicks,
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
            pointBorderWidth={1}
            pointBorderColor={{
                from: 'color',
                modifiers: [['darker', 0.3]],
            }}
            theme={{
                grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
            }}
            useMesh={true}
            enableSlices={false}
            enableArea={true}
        />
    );
};

export default DateLineGraph;
