import { ResponsiveHeatMapCanvas } from '@nivo/heatmap';
import { useMediaQuery } from 'react-responsive';
import { rgb } from 'd3-color';

type HeatMapGroupWithMetaData = {
    x: string;
    y: number;
};

export type heatmapData = {
    id: string;
    data: HeatMapGroupWithMetaData[];
}[];

export default function TimeActivityHeatMap({ data, threshold }: { data: heatmapData; threshold: number }) {
    const showLabels = useMediaQuery({ minWidth: '1280px' }) && data[0].data.length < 30;
    // labels become cluttered if below 1280px or more than 29 days
    const getContrastColor = (bgColor: string) => {
        const c = rgb(bgColor);
        const luminance = (299 * c.r + 587 * c.g + 114 * c.b) / 1000;
        return luminance > 186 ? '#000000' : '#ffffff';
    };
    return (
        <div className="hover:cursor-pointer h-full">
            <ResponsiveHeatMapCanvas
                data={data}
                margin={{ top: 130, right: 180, bottom: 80, left: 20 }}
                valueFormat={'>-.0%'}
                label={showLabels ? (props) => props.formattedValue ?? '0%' : () => ''}
                yInnerPadding={0.15}
                labelTextColor={(cell) => getContrastColor(cell.color)}
                axisTop={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -90,
                    legend: '',
                    legendOffset: 46,
                }}
                axisRight={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 30,
                    format: (tick) => (typeof tick === 'string' && tick.length > 30 ? tick.slice(0, 30) + '...' : tick),
                }}
                axisLeft={null}
                colors={{
                    type: 'sequential',
                    colors: ['#4b63a1', '#ffffff'],
                    minValue: 0,
                    maxValue: threshold / 100,
                }}
                tooltip={({ cell }) => {
                    return (
                        <div className="bg-gray-900 text-white p-2 rounded text-xs">
                            <span className="font-bold">{cell.value ? `${(cell.value * 100).toFixed(0)}%` : `0%`}</span>
                            <br />
                            Dato: {cell.data.x}
                            <br />
                            Køretøj: {cell.serieId}
                        </div>
                    );
                }}
                emptyColor="#555555"
                enableLabels={true}
                legends={[
                    {
                        anchor: 'top',
                        translateX: -20,
                        translateY: -100,
                        length: 400,
                        thickness: 8,
                        direction: 'row',
                        tickPosition: 'after',
                        tickSize: 3,
                        tickSpacing: 4,
                        tickOverlap: false,
                        tickFormat: '>-.0%',
                        title: 'Procentvis udnyttelse →',
                        titleAlign: 'start',
                        titleOffset: 4,
                    },
                ]}
                annotations={[]}
            />
        </div>
    );
}
