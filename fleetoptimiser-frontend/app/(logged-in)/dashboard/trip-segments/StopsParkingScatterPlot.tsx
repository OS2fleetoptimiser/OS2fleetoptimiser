import { generateFromPalette } from '@/components/ColorGenerator';
import { ResponsiveScatterPlotCanvas, ScatterPlotDatum } from '@nivo/scatterplot';
import { isInteger } from 'lodash';

export interface scatterPlotEntry extends ScatterPlotDatum {
    tripId: number;
    distance: number;
    stops: number;
    parkingTime: number;
    date: string;
    name: string;
}

export type scatterplotProps = {
    id: string;
    data: scatterPlotEntry[];
}[];

const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    const minuteString = `${remainingMinutes} ${remainingMinutes === 1 ? 'minut' : 'minutter'}`;

    if (hours === 0) return minuteString;

    return `${hours} ${hours === 1 ? 'time' : 'timer'}, ${minuteString}`;
};

const ParkingTimeScatterPlot = ({
    data,
    distance,
    setFocus,
    focus,
    setSelected,
}: {
    data: scatterplotProps;
    distance: boolean;
    setFocus: (id: string | undefined) => void;
    focus?: string;
    setSelected: (id: number | undefined) => void;
}) => {
    return (
        <ResponsiveScatterPlotCanvas
            onMouseLeave={(d) => setFocus(undefined)}
            onMouseMove={(node) => setFocus(node.serieId.toString())}
            onClick={(d) => {
                const clickedData = d.data as scatterPlotEntry;
                setSelected(clickedData.tripId);
            }}
            data={data}
            colors={(node) => {
                const vehicle = node.serieId.toString();
                if (!focus) {
                    return generateFromPalette(vehicle);
                } else {
                    return vehicle !== focus ? generateFromPalette(vehicle, 0.2) : generateFromPalette(vehicle);
                }
            }}
            nodeSize={(node) => (node.serieId.toString() === focus ? 15 : 10)}
            margin={{ top: 20, right: 40, bottom: 70, left: 90 }}
            xScale={{ type: 'linear', min: 0, max: 'auto' }}
            xFormat=">-.2f"
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            yFormat=">-.2f"
            axisTop={null}
            axisRight={null}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: distance ? 'Samlet distance på rundturen (km)' : 'Antal stop på rundturen',
                legendPosition: 'middle',
                legendOffset: 46,
                format: (v) => (isInteger(v) ? v : ''),
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Parkeringstid på rundturen (minutter)',
                legendPosition: 'middle',
                legendOffset: -60,
                format: (v) => (isInteger(v) ? v : ''),
            }}
            tooltip={(node) => {
                const entry = node.node.data as scatterPlotEntry;
                return (
                    <div className="bg-white p-2 shadow-md">
                        <p>
                            <span className="font-bold">Køretøj:</span> {entry.name}
                        </p>
                        <p>Tur start: {entry.date}</p>
                        <p>Distance: {(+entry.distance.toFixed(2)).toLocaleString()} km</p>
                        <p>Antal stop: {entry.stops}</p>
                        <p>Parkeringstid: {formatMinutes(entry.parkingTime)}</p>
                    </div>
                );
            }}
        />
    );
};

export default ParkingTimeScatterPlot;
