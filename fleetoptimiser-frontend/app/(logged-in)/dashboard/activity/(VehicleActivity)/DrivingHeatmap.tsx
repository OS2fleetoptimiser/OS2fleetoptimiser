import { ComputedCell, ResponsiveHeatMapCanvas } from '@nivo/heatmap';
import 'd3-scale-chromatic';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';

export type HeatMapGroupWithMetaData = {
    x: string;
    y: number | null | undefined;
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
};

export type heatmapData = {
    id: string;
    data: HeatMapGroupWithMetaData[];
    idInt?: number;
}[];

export const DrivingHeatmapKm = ({
    data,
    maxHeatValue,
    setLocationZoom,
}: {
    data: heatmapData;
    maxHeatValue?: number;
    setLocationZoom: (cell: ComputedCell<HeatMapGroupWithMetaData>) => void;
}) => {
    const showLabels = useMediaQuery({ minWidth: '1280px' }) && data[0].data.length < 30; // labels become cluttered below width and with many cells
    return (
        <div className="hover:cursor-pointer h-full">
            <ResponsiveHeatMapCanvas
                data={data}
                margin={{ top: 130, right: 180, bottom: 80, left: 20 }}
                valueFormat={(v) => Math.round(v).toLocaleString()}
                yInnerPadding={0.15}
                axisTop={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -90,
                    legendOffset: 46,
                }}
                label={showLabels ? (props) => props.formattedValue ?? '0' : () => ''}
                onClick={(cell) => {
                    setLocationZoom(cell);
                }}
                tooltip={({ cell }) => {
                    return (
                        <div className="bg-gray-900 text-white p-2 rounded text-xs">
                            <span className="font-bold">{cell.value ? `${cell.value.toFixed(1)} km` : '0 km'}</span>
                            <br />
                            Dato: {cell.data.x}
                            <br />
                            Køretøj: {cell.serieId}
                        </div>
                    );
                }}
                animate={true}
                motionConfig="gentle"
                hoverTarget="rowColumn"
                axisLeft={null}
                axisRight={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 30,
                    format: (tick) => (typeof tick === 'string' && tick.length > 30 ? tick.slice(0, 30) + '...' : tick),
                }}
                colors={{
                    type: 'sequential',
                    colors: ['#b95f5f', '#ffffff'],
                    minValue: 0,
                    maxValue: maxHeatValue,
                }}
                emptyColor="#b6b7b9"
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
                        tickFormat: '>-.2s',
                        title: 'Kørte km →',
                        titleAlign: 'start',
                        titleOffset: 4,
                    },
                ]}
            />
        </div>
    );
};
