import { ResponsiveLineCanvas } from '@nivo/line';
import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import React from 'react';

type PointProps = {
    x: string;
    y: number;
};

type AvailabilityData = {
    totalVehicles: number;
    data: PointProps[];
};

export const AvailabilityGraph = ({ data, totalVehicles }: AvailabilityData) => {
    return (
        <ResponsiveLineCanvas
            data={[{ id: 'Ledighed', data: data }]}
            margin={{ top: 20, right: 80, bottom: 120, left: 80 }}
            yScale={{
                type: 'linear',
                stacked: false,
            }}
            tooltip={({ point }) => {
                return (
                    <div className="bg-gray-900 text-white p-2 rounded text-xs">
                        <p>Ledige køretøjer: {point.data.yFormatted}</p>
                        <p>{point.data.xFormatted}</p>
                    </div>
                );
            }}
            xScale={{
                type: 'time',
                format: '%Y-%m-%dT%H:%M:%S',
                useUTC: false,
                precision: 'minute',
            }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            axisLeft={{
                legend: 'Antal ledige køretøjer',
                legendOffset: -60,
                legendPosition: 'middle',
                tickValues: getYTicks([totalVehicles]),
            }}
            axisBottom={{
                legend: 'Tidspunkt',
                legendOffset: 100,
                legendPosition: 'middle',
                tickRotation: 45,
                format: (x: Date) => x.toLocaleString(),
            }}
            colors="#4b63a1"
            isInteractive={true}
            pointSize={0}
            theme={{
                grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
            }}
        />
    );
};
