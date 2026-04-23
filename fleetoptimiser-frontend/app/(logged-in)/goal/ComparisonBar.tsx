import { getYTicks } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import { ResponsiveBar } from '@nivo/bar';
import { chartLabelLight, chartPalette, nivoTheme } from '@/theme/nivoTheme';
import { gray } from '@/theme/themePrimitives';
import { useMediaQuery } from 'react-responsive';
import ChartTooltip from '@/components/ChartTooltip';

type Solution = {
    label: string;
    value: number;
};

type Props = {
    currentValue: number;
    solutions: Solution[];
    yAxis: string;
};

export function CostComparisonBar({ currentValue, solutions, yAxis }: Props) {
    const showTicks = useMediaQuery({ minWidth: '850px' }); // ticks become overlapping below 850px
    const data = [
        { id: 'Nuværende', value: currentValue, color: gray[500] },
        ...solutions.map((sol) => ({
            id: sol.label,
            value: sol.value,
            color: chartPalette.blue500,
        })),
    ];

    const isEmission = yAxis.toLowerCase().includes('co2e');

    const formatValue = (val: number) =>
        isEmission ? val.toLocaleString('da-DK', { maximumFractionDigits: 2 }) : val.toLocaleString('da-DK', { maximumFractionDigits: 0 });

    const yTicks = getYTicks(data.map((entry) => entry.value));
    return (
        <ResponsiveBar
            data={data}
            keys={['value']}
            borderRadius={3}
            indexBy="id"
            colors={(bar) => bar.data.color}
            margin={{ top: 20, right: 50, bottom: 60, left: 90 }}
            padding={0.3}
            axisLeft={{
                legend: yAxis,
                legendPosition: 'middle',
                legendOffset: -70,
                tickValues: yTicks,
                format: (val) => formatValue(Number(val)),
            }}
            axisBottom={{
                tickSize: 0,
                tickPadding: 5,
                tickValues: showTicks ? undefined : [],
            }}
            valueFormat={(val) => formatValue(Number(val))}
            labelTextColor={chartLabelLight}
            theme={nivoTheme}
            tooltip={({ value, indexValue, color }) => (
                <ChartTooltip
                    title={String(indexValue)}
                    accentColor={color}
                    rows={[{ label: yAxis, value: formatValue(Number(value)) }]}
                />
            )}
        />
    );
}
