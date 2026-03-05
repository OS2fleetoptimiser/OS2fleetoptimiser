import { ResponsiveBar } from '@nivo/bar';

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
            colors={(bar) => (bar.data.solution === 'Mål' ? 'gray' : '#1565c0')}
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
            labelTextColor={'white'}
            valueFormat={(v) => v.toLocaleString()}
            role="application"
        />
    );
};

export default CostChart;
