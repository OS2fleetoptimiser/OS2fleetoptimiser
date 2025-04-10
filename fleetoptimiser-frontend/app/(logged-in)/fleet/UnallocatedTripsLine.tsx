import { ResponsiveLine } from '@nivo/line';
import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import dayjs from 'dayjs';
import ToolTip from '@/components/ToolTip';
import { drivingBook } from '@/components/hooks/useSimulateFleet';

export const getYTicks = (sums: number[], maxTicks: number = 5) => {
    const maxAntal = Math.max(...sums);
    if (maxAntal === 0) {
        return [0];
    }
    const increment = Math.ceil(maxAntal / (maxTicks - 1));
    let ticks = [];
    for (let i = 0; i <= maxAntal; i += increment) {
        ticks.push(i);
    }
    if (!ticks.includes(maxAntal)) {
        ticks.push(maxAntal);
    }
    return ticks;
};

export const UnallocatedTripsLineChart = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const getTripsByDate = (data: drivingBook[]) => {
        let tripsByDate = [{ id: 'Simulation', data: [] as { x: string; y: number }[] }];
        tripsByDate = data.reduce((acc, cur) => {
            const day = dayjs(cur.start_time).format('YYYY-MM-DD');
            let existingSim = acc[0].data.find((item) => item.x === day);
            if (!existingSim) {
                acc[0].data.push({
                    x: day,
                    y: 0,
                });
            }

            if (cur.simulation_type === -1) {
                let existing = acc[0].data.find((item) => item.x === day);
                if (existing) existing.y++;
            }
            return acc;
        }, tripsByDate);
        return tripsByDate;
    };
    const data = getTripsByDate(simulationResults.drivingBook);
    const ySums = data.map((simulationType) => {
        return Math.max(...simulationType.data.map((dataEntry) => dataEntry.y));
    });
    const yTicks = getYTicks(ySums); // need this to control count and float values

    return (
        <div className="p-4 pt-2 bg-white rounded-md shadow-sm border border-gray-100 w-full h-full overflow-y-auto">
            <div className="flex items-center">
                <span className="text-sm font-semibold">Ikke kørte rundture pr. dag</span>
                <ToolTip>
                    Overblik over fordelingen af ukørte ture over den valgte datoperiode. Såfremt der er ture, der ikke er blevet kørt vil det vise sig som et
                    udsving i nedenstående trendlinje. Der vises en linje for både den nuværende - og den valgte simulerede pulje.
                </ToolTip>
            </div>
            <div style={{ height: '320px' }}>
                <ResponsiveLine
                    data={data}
                    margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
                    xScale={{
                        type: 'time',
                        format: '%Y-%m-%d',
                        precision: 'day',
                    }}
                    yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false }}
                    axisLeft={{
                        legend: 'Antal rundture uden køretøj',
                        legendOffset: -40,
                        legendPosition: 'middle',
                        tickValues: yTicks,
                    }}
                    axisBottom={{
                        tickSize: 5,
                        tickPadding: 5,
                        tickRotation: 0,
                        legend: 'Dato',
                        legendOffset: 36,
                        format: '%d/%m/%y',
                        legendPosition: 'middle',
                        tickValues: 5, // todo check this
                    }}
                    enableGridX={false}
                    curve="linear"
                    lineWidth={2}
                    pointSize={1}
                    pointBorderWidth={2}
                    enableArea={false}
                    useMesh={true}
                    colors={['#9CA3AF']}
                    tooltip={({ point }) => (
                        <div
                            style={{
                                background: '#222',
                                color: 'white',
                                padding: '6px 9px',
                                borderRadius: 4,
                                fontSize: '12px',
                            }}
                        >
                            Dato: <span className="font-bold">{dayjs(point.data.x).format('DD/MM/YYYY')}</span>
                            <br />
                            Ikke kørte ture: <span className="font-bold">{(point.data.yFormatted || point.data.y).toString()}</span>
                        </div>
                    )}
                    theme={{
                        grid: { line: { stroke: '#ddd', strokeDasharray: '2 3' } },
                    }}
                />
            </div>
        </div>
    );
};
