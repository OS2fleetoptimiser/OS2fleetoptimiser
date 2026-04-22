import { ResponsiveBar } from '@nivo/bar';
import { Typography } from '@mui/material';
import { LocationUsage } from '@/components/hooks/useGetLandingPage';
import { nivoTheme } from '@/theme/nivoTheme';
import { brand } from '@/theme/themePrimitives';
import ChartTooltip from '@/components/ChartTooltip';

interface BarData extends LocationUsage {
    [key: string]: any;
}

const UsageBarChart = ({ data, showKeys = true }: { data: BarData[]; showKeys?: boolean }) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const formatted = oneMonthAgo.toISOString().split('T')[0];

    return (
        <div style={{ height: 400 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 2 }}>
                Laveste udnyttelsesgrad seneste måned
            </Typography>
            <ResponsiveBar
                data={data}
                keys={['usage_ratio']}
                indexBy="address"
                margin={{ top: 10, right: 20, bottom: 100, left: 60 }}
                padding={0.4}
                colors={brand[400]}
                borderRadius={4}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    renderTick: ({ value, x, y }) => (
                        <g className={`${showKeys ? 'inline' : 'hidden'}`} transform={`translate(${x},${y + 10})`}>
                            <title>{value}</title>
                            <text textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: '#333' }}>
                                {value.length > 10 ? `${value.substring(0, 10)}..` : value}
                            </text>
                        </g>
                    ),
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 10,
                    format: (v) => `${(v * 100).toFixed(1)}%`,
                }}
                label={({ value }) => `${(value ? value * 100 : 0).toFixed(1)}%`}
                labelTextColor="white"
                labelSkipWidth={16}
                labelSkipHeight={16}
                tooltip={({ indexValue, value, color }) => (
                    <ChartTooltip
                        title={`Lokation: ${indexValue}`}
                        accentColor={color}
                        rows={[{ label: 'Udnyttelsesgrad af køretøjer', value: `${(value * 100).toFixed(1)}%` }]}
                    />
                )}
                onClick={({ data }) => {
                    window.location.href = `/dashboard/timeactivity?startdate=${formatted}&locations=${data.location_id}`;
                }}
                theme={nivoTheme}
                enableLabel={true}
                role="button"
                onMouseEnter={(_data, event) => (event.currentTarget.style.cursor = 'pointer')}
                onMouseLeave={(_data, event) => (event.currentTarget.style.cursor = 'default')}
            />
        </div>
    );
};

export default UsageBarChart;
