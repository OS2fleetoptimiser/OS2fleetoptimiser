import { ComputedCell, ResponsiveHeatMapCanvas } from '@nivo/heatmap';
import 'd3-scale-chromatic';
import { nivoTheme, chartPalette } from '@/theme/nivoTheme';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';
import ChartTooltip from '@/components/ChartTooltip';

export type HeatMapGroupWithMetaData = {
    x: string;
    y: number | null | undefined;
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    workshop?: boolean;
};

// red (no driving) -> white (max driving); mirrors the sequential heatmapWarningGradient
const drivingColor = (value: number | null | undefined, maxHeatValue?: number) => {
    if (value === null || value === undefined) return chartPalette.heatmapEmpty;
    const max = maxHeatValue && maxHeatValue > 0 ? maxHeatValue : 1;
    const t = Math.max(0, Math.min(1, value / max));
    const saturation = 55 * (1 - t);
    const lightness = 58 + 42 * t;
    return `hsl(0, ${saturation}%, ${lightness}%)`;
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
    const showLabels = useMediaQuery({ minWidth: '1280px' }) && data[0].data.length <= 31; // labels become cluttered below width and with many cells
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
                tooltip={({ cell }) => (
                    <ChartTooltip
                        title={`Køretøj: ${cell.serieId}`}
                        accentColor={cell.color}
                        rows={[
                            { label: 'Dato', value: String(cell.data.x) },
                            { label: 'Kørsel', value: cell.value ? `${cell.value.toFixed(1)} km` : '0 km' },
                        ]}
                    />
                )}
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
                colors={(cell) =>
                    cell.data.workshop ? chartPalette.heatmapWorkshop : drivingColor(cell.value, maxHeatValue)
                }
                theme={nivoTheme}
                emptyColor={chartPalette.heatmapEmpty}
            />
        </div>
    );
};

const legendItems = [
    { color: 'hsl(0, 55%, 58%)', label: 'Ingen kørsel' },
    { color: '#ffffff', label: 'Kørsel' },
    { color: chartPalette.heatmapEmpty, label: 'Aktiv rundtur, ingen kørsel' },
    { color: chartPalette.heatmapWorkshop, label: 'Værkstedsbesøg' },
];

export const DrivingHeatmapLegend = () => (
    <div className="flex flex-wrap gap-4 mb-2">
        {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
                <span
                    className="inline-block w-3 h-3 rounded-sm border border-gray-300"
                    style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-600">{item.label}</span>
            </div>
        ))}
    </div>
);
