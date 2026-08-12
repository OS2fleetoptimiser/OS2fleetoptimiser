import { ComputedCell, ResponsiveHeatMapCanvas } from '@nivo/heatmap';
import 'd3-scale-chromatic';
import { nivoTheme, chartPalette, heatmapWarningGradient, heatmapWarningHsl } from '@/theme/nivoTheme';
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

// red (no driving) -> white (max driving); interpolated from the same palette values
// as heatmapWarningGradient so the cells and the legend strip cannot drift apart
const drivingColor = (value: number | null | undefined, maxHeatValue?: number) => {
    if (value === null || value === undefined) return chartPalette.heatmapEmpty;
    const max = maxHeatValue && maxHeatValue > 0 ? maxHeatValue : 1;
    const t = Math.max(0, Math.min(1, value / max));
    const { hue, saturation, lightness } = heatmapWarningHsl;
    return `hsl(${hue}, ${saturation * (1 - t)}%, ${lightness + (100 - lightness) * t}%)`;
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

// the categories the km scale cannot express; the scale itself is the gradient strip
const legendItems = [
    { color: chartPalette.heatmapEmpty, label: 'Aktiv rundtur, ingen kørsel' },
    { color: chartPalette.heatmapWorkshop, label: 'Værkstedsbesøg' },
];

export const DrivingHeatmapLegend = ({ maxHeatValue }: { maxHeatValue?: number }) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">Kørte km</span>
            <span className="text-xs text-gray-600">0</span>
            <span
                className="inline-block w-24 h-2.5 rounded-sm border border-gray-300"
                style={{
                    backgroundImage: `linear-gradient(to right, ${heatmapWarningGradient[0]}, ${heatmapWarningGradient[1]})`,
                }}
            />
            {maxHeatValue !== undefined && (
                <span className="text-xs text-gray-600">{maxHeatValue.toLocaleString('da-DK')}+</span>
            )}
        </div>
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
