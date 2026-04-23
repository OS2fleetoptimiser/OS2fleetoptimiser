import { ResponsiveLineCanvas } from '@nivo/line';
import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import { chartPalette, nivoTheme } from '@/theme/nivoTheme';
import React from 'react';
import ChartTooltip from '@/components/ChartTooltip';

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
            tooltip={({ point }) => (
                <ChartTooltip
                    title={String(point.data.xFormatted)}
                    accentColor={point.seriesColor}
                    rows={[{ label: 'Ledige køretøjer', value: String(point.data.yFormatted) }]}
                />
            )}
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
            colors={chartPalette.blue500}
            isInteractive={true}
            pointSize={0}
            theme={nivoTheme}
        />
    );
};
