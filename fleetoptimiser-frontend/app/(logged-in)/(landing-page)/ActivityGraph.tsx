import { ResponsiveHeatMap } from '@nivo/heatmap';

interface ActivityHeatmapProps {
    data: {
        id: string;
        address: string;
        locationId: string;
        data: {
            x: string;
            y: number;
            start_date: string;
            end_date: string;
        }[];
    }[];
}

function getDateRangeFromYearWeek(yearWeek: string): { start: string; end: string } {
    const [yearStr, weekStr] = yearWeek.split('-');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);

    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - (jan4Day - 1));

    const isoWeekStart = new Date(mondayOfWeek1);
    isoWeekStart.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

    const isoWeekEnd = new Date(isoWeekStart);
    isoWeekEnd.setDate(isoWeekStart.getDate() + 6);

    return {
        start: isoWeekStart.toISOString().split('T')[0],
        end: isoWeekEnd.toISOString().split('T')[0],
    };
}

const normalizeData = (data: ActivityHeatmapProps['data']) => {
    // need this function to assert all weeks are present in each location set
    // also asserts that data array is sorted correctly on weeks
    const allWeeks = Array.from(new Set(data.flatMap((loc) => loc.data.map((d) => d.x))));

    return data.map((location) => ({
        id: location.address,
        address: location.address,
        locationId: location.id,
        data: allWeeks
            .map((week) => {
                const weekData = location.data.find((d) => d.x === week);
                const { start, end } = weekData
                    ? { start: weekData.start_date, end: weekData.end_date }
                    : getDateRangeFromYearWeek(week);

                return {
                    x: week,
                    y: weekData?.y ?? 0,
                    start_date: start,
                    end_date: end,
                };
            })
            .sort((a, b) => {
                const [aYear, aWeek] = a.x.split('-').map(Number);
                const [bYear, bWeek] = b.x.split('-').map(Number);
                return aYear !== bYear ? aYear - bYear : aWeek - bWeek;
            }),
    }));
};

const ActivityHeatmap = ({ data, showKeys = true }: ActivityHeatmapProps & { showKeys?: boolean }) => {
    const normalizedData = normalizeData(data);
    const addressToIdMap = Object.fromEntries(data.map((loc) => [loc.address, loc.id]));
    return (
        <div style={{ height: 400 }}>
            <h4 className="font-semibold mb-4 text-center text-gray-500">Lokationer med laveste gennemsnitlig kørsel</h4>
            <ResponsiveHeatMap
                data={normalizedData}
                yInnerPadding={0.4}
                margin={{ top: 20, right: 70, bottom: 100, left: showKeys ? 70 : 20 }}
                axisTop={
                    showKeys
                        ? {
                              tickSize: 5,
                              tickPadding: 5,
                              tickRotation: 0,
                              format: (value) => 'Uge ' + value.split('-')[1],
                          }
                        : null
                }
                colors={{
                    type: 'sequential',
                    colors: ['#b95f5f', '#fff'],
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    renderTick: ({ value, x, y }) => (
                        <g className={`${showKeys ? 'inline' : 'hidden'}`} transform={`translate(${x - 35},${y})`}>
                            <title>{value}</title>
                            <text textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: '#333' }}>
                                {value.length > 10 ? `${value.substring(0, 10)}..` : value}
                            </text>
                        </g>
                    ),
                }}
                label={({ value }) => (value ? `${value.toFixed(0)} km` : "0 km")}
                animate={true}
                motionConfig="gentle"
                hoverTarget="cell"
                tooltip={({ cell }) => {
                    return (
                        <div
                            style={{
                                background: '#222',
                                color: 'white',
                                padding: '6px 9px',
                                borderRadius: 4,
                                fontSize: '12px',
                            }}
                        >
                            Gennemsnitslig kørsel pr. køretøj: <span className="font-bold">{cell.value ? `${cell.value.toFixed(1)} km` : "0 km"}</span> <br />
                            År-uge: {cell.data.x} <br />
                            Lokation: {cell.serieId} <br />
                            Gå til køretøjsaktivitet
                        </div>
                    );
                }}
                onClick={(cell) => {
                    const locationId = addressToIdMap[cell.serieId];
                    window.location.href = `/dashboard/activity?startdate=${cell.data.start_date}&enddate=${cell.data.end_date}&locations=${locationId}`;
                }}
                theme={{
                    labels: { text: { fontWeight: 'bold', fontSize: '0.75rem' } },
                }}
                legends={[
                    {
                        anchor: 'right',
                        translateX: 30,
                        length: 200,
                        thickness: 8,
                        direction: 'column',
                        tickPosition: 'after',
                        tickSize: 3,
                        tickSpacing: 4,
                        tickOverlap: false,
                        title: 'Km',
                        titleAlign: 'start',
                        titleOffset: 4,
                    },
                ]}
            />
        </div>
    );
};

export default ActivityHeatmap;
