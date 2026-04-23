import { ResponsiveBar } from '@nivo/bar';
import { chartLabelLight, chartPalette, nivoTheme } from '@/theme/nivoTheme';
import { gray } from '@/theme/themePrimitives';
import ChartTooltip from '@/components/ChartTooltip';

type dataEntry = {
    solution: string;
    cost: number;
};

const CostChart = ({ data }: { data: dataEntry[] }) => {
    return (
        <ResponsiveBar
            data={data}
            keys={['cost']}
            indexBy="solution"
            margin={{ top: 50, right: 10, bottom: 50, left: 60 }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={(bar) => (bar.data.solution === 'Mål' ? gray[400] : chartPalette.blue500)}
            borderColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Løsninger',
                legendPosition: 'middle',
                legendOffset: 32,
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'kr. pr. år',
                legendPosition: 'middle',
                legendOffset: -40,
                format: (v) => {
                    const value = v as number;
                    if (value !== 0) return value / 1000 + 'k';
                    else return 0;
                },
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={chartLabelLight}
            valueFormat={(v) => v.toLocaleString()}
            tooltip={({ value, indexValue, color }) => (
                <ChartTooltip
                    title={String(indexValue)}
                    accentColor={color}
                    rows={[{ label: 'Omkostning', value: `${value.toLocaleString()} kr./år` }]}
                />
            )}
            theme={nivoTheme}
            role="application"
        />
    );
};

export default CostChart;
