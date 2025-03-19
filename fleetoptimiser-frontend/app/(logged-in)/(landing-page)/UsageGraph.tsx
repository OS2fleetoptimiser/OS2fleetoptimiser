import { ResponsiveBar } from '@nivo/bar';
import { LocationUsage } from '@/components/hooks/useGetLandingPage';

interface BarData extends LocationUsage {
    [key: string]: any;
}

const UsageBarChart = ({ data, showKeys = true }: { data: BarData[]; showKeys?: boolean }) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const formatted = oneMonthAgo.toISOString().split('T')[0];

    return (
        <div style={{ height: 400 }}>
            <h4 className="font-semibold mb-4 text-center text-gray-500">Laveste udnyttelsesgrad seneste måned</h4>
            <ResponsiveBar
                data={data}
                keys={['usage_ratio']}
                indexBy="address"
                margin={{ top: 10, right: 20, bottom: 100, left: 60 }}
                padding={0.4}
                colors="#4b63a1"
                borderRadius={4}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    renderTick: ({ value, x, y, textAnchor }) => (
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
                tooltip={({ indexValue, value }) => (
                    <div
                        style={{
                            background: '#222',
                            color: 'white',
                            padding: '6px 9px',
                            borderRadius: 4,
                            fontSize: '12px',
                        }}
                    >
                        Udnyttelsesgrad af køretøjer: <span className="font-bold">{(value * 100).toFixed(1)}%</span>
                        <br></br>
                        Lokation: {indexValue} <br />
                        <span>Gå til tidsaktivitetsdashboard</span>
                    </div>
                )}
                onClick={({ data }) => {
                    window.location.href = `/dashboard/timeactivity?startdate=${formatted}&locations=${data.location_id}`;
                }}
                theme={{
                    axis: { ticks: { text: { fontSize: 12, fill: '#555' } } },
                    grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
                    labels: { text: { fontWeight: 'bold', fontSize: '0.75rem' } },
                }}
                enableLabel={true}
                role="button"
                onMouseEnter={(_data, event) => (event.currentTarget.style.cursor = 'pointer')}
                onMouseLeave={(_data, event) => (event.currentTarget.style.cursor = 'default')}
            />
        </div>
    );
};

export default UsageBarChart;
