import React, { useState } from 'react';

import { ResponsiveLine, LineSeries, LineCustomSvgLayerProps, LineCustomSvgLayer } from '@nivo/line';
import { line } from 'd3-shape';
import { generateParkingSegments, generateDrivingSegments, generateAccumulatedDriving, formatTimeFromISO } from './SegmentUtility';

interface FillDataInput extends LineCustomSvgLayerProps<LineSeries> {
    series: FillDataset[];
}

interface CustomLineInput extends Omit<LineCustomSvgLayerProps<LineSeries>, 'xScale' | 'yScale'> {
    series: FillDataset[];
    xScale: (value: number | Date | string) => number;
    yScale: (value: number) => number;
}

type FillDataset = {
    color: string;
    data: DataItem[];
    id: string;
};

type DataItem = {
    data: DataDetails;
    position: Point;
};

type DataDetails = {
    accumulated_distance: number;
    distance: number;
    driving_time: string;
    parking_time?: string;
    fra: string;
    til: string;
    x: string;
    y: number;
};

type SegmentData = {
    id: string;
    color: string;
    data: {
        x: string;
        y: number;
        accumulated_distance: number;
        parking_time?: string;
        driving_time?: string;
        distance?: number;
        fra?: string;
        til?: string;
        ender?: boolean;
    }[];
};

interface PointData {
    x: string;
    y: number;
    accumulated_distance: number;
    xFormatted: string;
    yFormatted: string;
    driving_time?: string;
    distance?: number;
    fra?: string;
    til?: string;
    parking_time?: string;
    ender?: boolean;
}

interface Point {
    x: number;
    y: number;
}

interface inputSegment {
    start_time: string;
    end_time: string;
    distance: number;
}

interface DataPoint {
    x: number | Date | string;
    y: number;
}

interface ToolTipPoint {
    serieId: string;
    serieColor: string;
    id: string;
    index: number;
    x: number;
    y: number;
    color: string;
    borderColor: string;
    data: PointData;
}

interface ToolTipWrap {
    point: ToolTipPoint;
}

const FillLayer = (props: FillDataInput): React.JSX.Element => {
    const { series, height } = props;
    // fill area below line

    return (
        <>
            {series.map((serie, index) => {
                const points = serie.data.map((d) => ({ x: d.position.x, y: d.position.y }));
                const pathD = line<Point>()
                    .x((d) => d.x)
                    .y((d) => d.y)(points);
                if (!pathD) return null;
                const closedPathD = `
                    M${points[0].x},${height ? height - 60 : 60 - 60}
                    L${points[0].x},${points[0].y}
                    ${pathD.slice(1)}
                    L${points[points.length - 1].x},${height ? height - 60 : 60 - 60}
                    Z
                `;

                return (
                    <React.Fragment key={index}>
                        <path d={closedPathD} fill={serie.color} fillOpacity={0.3} />
                        <path d={pathD} fill="none" stroke={serie.color} />
                    </React.Fragment>
                );
            })}
        </>
    );
};

const CustomLines = (props: CustomLineInput): React.JSX.Element => {
    const { series, xScale, yScale } = props;
    const [hoveredLine, setHoveredLine] = useState<number | null>(null);
    const lineGenerator = line<DataPoint>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y));

    const boxWidth = 250; // Adjusted box width
    const boxHeight = 120; // Adjusted box height based on the amount of text

    const boxMargin = 10;
    const textPadding = 15; // Padding from the left
    const lineHeight = 20; // Space between lines

    return (
        <g>
            {series.map((serie, i) => {
                const points = serie.data.map((d) => ({ x: d.data.x, y: d.data.y }));
                const linePath = lineGenerator(points);
                const driving_time = serie.data[0]?.data.driving_time;
                const from = serie.data[0]?.data.fra;
                const to = serie.data[0]?.data.til;
                const distance = serie.data[0]?.data.distance;
                const accumulated_distance = serie.data[0]?.data.accumulated_distance;
                const parking_time = serie.data[0]?.data.parking_time;
                let dynamicLineWidth = serie.id.includes('dist') ? 1 : 20;
                if (hoveredLine === i) {
                    dynamicLineWidth += 4;
                }
                const isLastItem = i === series.length - 1;

                return (
                    <React.Fragment key={i}>
                        {linePath ? (
                            <path
                                d={linePath}
                                fill="none"
                                stroke={serie.color}
                                strokeWidth={dynamicLineWidth}
                                onMouseEnter={isLastItem ? undefined : () => setHoveredLine(i)}
                                onMouseLeave={isLastItem ? undefined : () => setHoveredLine(null)}
                            />
                        ) : null}
                        {hoveredLine === i ? (
                            <>
                                <rect x={boxMargin} y={boxMargin} width={boxWidth} height={boxHeight} fill="white" stroke="grey" strokeWidth={1} />
                                {serie.id.includes('Parkering') ? (
                                    <text x={boxMargin + textPadding} y={boxMargin + textPadding}>
                                        <tspan x={boxMargin + textPadding} className="font-bold" dy="0.5em" fill={serie.color}>
                                            {serie.id}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Parkeringstid: {parking_time}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Fra {from ? formatTimeFromISO(from) : 'Ukendt'} til {to ? formatTimeFromISO(to) : 'Ukendt'}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Akkumuleret distance: {Math.round(accumulated_distance * 100) / 100} km
                                        </tspan>
                                    </text>
                                ) : serie.id.includes('Kørsel') ? (
                                    <text x={boxMargin + textPadding} y={boxMargin + textPadding}>
                                        <tspan x={boxMargin + textPadding} className="font-bold" dy="0.5em" fill={serie.color}>
                                            {serie.id}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Kørselstid: {driving_time}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Fra {from ? formatTimeFromISO(from) : 'Ukendt'} til {to ? formatTimeFromISO(to) : 'Ukendt'}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Distance: {distance}
                                        </tspan>
                                        <tspan x={boxMargin + textPadding} dy={lineHeight} fill="grey">
                                            Akkumuleret distance: {Math.round(accumulated_distance * 100) / 100} km
                                        </tspan>
                                    </text>
                                ) : null}
                            </>
                        ) : null}
                    </React.Fragment>
                );
            })}
        </g>
    );
};

const ToolTipGen = (pointDec: ToolTipWrap): React.JSX.Element => {
    const { point } = pointDec;
    if (!point.serieId) {
        return <div />;
    }
    return (
        <div className="bg-white p-3 border border-gray-300 ">
            <div>
                <strong>{point.serieId}</strong>
            </div>
            <div style={{ color: '#A6A6A6', padding: '3px 0' }}>Akkumuleret distance: {Math.round(point.data.accumulated_distance * 100) / 100} km.</div>
        </div>
    );
};

type rtchartinput = {
    segmentData: inputSegment[] | undefined;
    currentVehicle: string | undefined;
};

const RoundTripChart = (props: rtchartinput) => {
    const { segmentData, currentVehicle } = props;
    if (!segmentData || segmentData.length === 0) {
        return <div />;
    }

    const parkingSegments = generateParkingSegments(segmentData);
    const drivingSegments = generateDrivingSegments(segmentData);
    const accumulatedDistance = generateAccumulatedDriving(segmentData);

    const transformed: SegmentData[] = [];

    for (let i = 0; i < drivingSegments.length; i++) {
        // loop in order to alternate the segments for appearance advantages
        transformed.push({
            id: drivingSegments[i].name,
            color: '#d1eff3', //'#7030A0',
            data: [
                {
                    // tilføj drivingSegment så det kan vises på den ny tooltip
                    x: drivingSegments[i].start_time,
                    y: 0,
                    accumulated_distance: drivingSegments[i].accumulated_distance,
                    driving_time: drivingSegments[i].driving_time,
                    distance: drivingSegments[i].distance,
                    fra: drivingSegments[i].start_time,
                    til: drivingSegments[i].end_time,
                    ender: false,
                },
                {
                    x: drivingSegments[i].end_time,
                    y: 0,
                    accumulated_distance: drivingSegments[i].accumulated_distance,
                    driving_time: drivingSegments[i].driving_time,
                    distance: drivingSegments[i].distance,
                    fra: drivingSegments[i].start_time,
                    til: drivingSegments[i].end_time,
                    ender: true,
                },
            ],
        });

        if (i < parkingSegments.length) {
            transformed.push({
                id: parkingSegments[i].name,
                color: '#038696',
                data: [
                    {
                        x: parkingSegments[i].start_time,
                        y: 0,
                        accumulated_distance: parkingSegments[i].accumulated_distance,
                        parking_time: parkingSegments[i].parking_time,
                        fra: parkingSegments[i].start_time,
                        til: parkingSegments[i].end_time,
                        ender: false,
                    },
                    {
                        x: parkingSegments[i].end_time,
                        y: 0,
                        accumulated_distance: parkingSegments[i].accumulated_distance,
                        parking_time: parkingSegments[i].parking_time,
                        fra: parkingSegments[i].start_time,
                        til: parkingSegments[i].end_time,
                        ender: true,
                    },
                ],
            });
        }
    }

    transformed.push({
        id: 'Akkumuleret distance',
        color: '#A6A6A6',
        data: accumulatedDistance.map((distance) => ({
            x: distance.time,
            y: distance.accumulated_distance,
            accumulated_distance: distance.accumulated_distance,
        })),
    });

    return (
        <div style={{ height: '400px', width: '100%' }}>
            <div className="flex justify-center">
                <div>
                    <h3 className="">Rundturens kørsels - og parkeringssegmenter</h3>
                    <h4 className="">
                        {formatTimeFromISO(segmentData[0].start_time)} - {formatTimeFromISO(segmentData[segmentData.length - 1].end_time)}
                    </h4>
                    <h4 className="">{currentVehicle}</h4>
                </div>
                <div className="items-center flex">
                    <p className="text-explanation text-xs ml-4 block w-96">Grafen viser den valgte rundtur og dens specifikke kørsels - og parkeringssegmenter. De lyse områder viser hvornår køretøjet har været i bevægelse, mens de mørke områder viser hvornår køretøjet har været parkeret. Der vises den akkumulerede kørte distance i den grå linje.</p>
                </div>
            </div>
            <ResponsiveLine
                tooltip={(d) => ToolTipGen(d as unknown as ToolTipWrap)}
                layers={[
                    'grid',
                    FillLayer as unknown as LineCustomSvgLayer<LineSeries>,
                    'axes',
                    'areas',
                    'crosshair',
                    'lines',
                    'slices',
                    'mesh',
                    CustomLines as unknown as LineCustomSvgLayer<LineSeries>,
                    'legends',
                    'points',
                ]}
                pointSize={0}
                data={transformed}
                xFormat="time:%Y-%m-%dT%H:%M:%S"
                xScale={{
                    format: '%Y-%m-%dT%H:%M:%S',
                    precision: 'second',
                    type: 'time',
                    useUTC: false,
                }}
                yScale={{ type: 'linear' }}
                useMesh={true}
                colors={(d) => (d as SegmentData).color}
                axisBottom={{
                    format: '%H:%M:%S',
                    legend: 'Tid',
                    legendOffset: 40,
                    legendPosition: 'middle',
                }}
                margin={{ top: 10, right: 170, bottom: 50, left: 60 }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Akkumuleret distance (km)',
                    legendOffset: -40,
                }}
                legends={[
                    {
                        anchor: 'right',
                        direction: 'column',
                        itemHeight: 20,
                        itemWidth: 80,
                        translateY: 10,
                        translateX: 100,
                        data: [
                            {
                                id: 'A',
                                label: 'Kørsel',
                                color: '#d1eff3',
                            },
                            {
                                id: 'B',
                                label: 'Parkering',
                                color: '#038696',
                            },
                            {
                                id: 'C',
                                label: 'Akkumuleret distance',
                                color: '#A6A6A6',
                            },
                        ],
                        effects: [
                            {
                                on: 'hover',
                                style: {
                                    itemBackground: 'rgba(0, 0, 0, .03)',
                                    itemOpacity: 1,
                                },
                            },
                        ],
                    },
                ]}
            />
        </div>
    );
};

export default RoundTripChart;
