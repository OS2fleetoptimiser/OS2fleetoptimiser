import {generateColor, generateFromPalette} from '@/components/ColorGenerator';
import { ResponsiveBar } from '@nivo/bar';
import { getYTicks } from "@/app/(logged-in)/fleet/UnallocatedTripsLine";

export type trip = {
    id: number;
    distance: number;
    parkedTime: number;
    stops: number;
    drivingTime: number;
    startTime: string;
};

export type ogData = {
    vehicle: string;
    department: string;
    Ture: number;
}[];

const TripSegmentGraph = ({ data, setFocus, focus }: { data: ogData; setFocus: (id: string | undefined) => void; focus?: string }) => {
    const showValuesOnAxis = data.length <= 60;

    const getTspanGroups = (entry?: ogData[number]) => {
        if (!entry) return [];
        if (!showValuesOnAxis) {
            return null;
        }
        const plate = entry.vehicle;
        const department = entry.department || '';
        const departmentWords = department.split(' ');

        let children: JSX.Element[] = [];

        children.push(
            <tspan
                x={0}
                dy={15}
                fontSize="14"
                fontFamily="'Roboto', 'Helvetica', 'Arial', sans-serif"
                key="plate"
            >
                {plate}
            </tspan>
        );

        departmentWords.forEach((word: any, index: number) => {
            children.push(
                <tspan x={-2} dy={index === 0 ? '10' : '10'} fontFamily="'Roboto', 'Helvetica', 'Arial', sans-serif" fontSize="9" key={`department-${index}`}>
                    {word}
                </tspan>
            );
        });

        return children;
    };

    const yValues = data.map((vehicle) => vehicle.Ture)
    const yTicks = getYTicks(yValues)
    return (
        <ResponsiveBar
            onMouseEnter={(d) => {
                setFocus(d.data.vehicle);
            }}
            onMouseLeave={(d) => setFocus(undefined)}
            data={data}
            keys={['Ture']}
            indexBy="vehicle"
            margin={{ top: 20, right: 40, bottom: 80, left: 60 }}
            padding={0.3}
            tooltip={({ data }) => (
                <div className="bg-white p-2 shadow-md">
                    <p>{`Køretøj: ${data.vehicle} ${data.department}`}</p>
                    <p>{`Ture: ${data.Ture}`}</p>
                </div>
            )}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={(d) => {
                if (!focus) {
                    return generateFromPalette(d.data.vehicle);
                } else {
                    return d.data.vehicle !== focus ? generateFromPalette(d.data.vehicle, 0.2) : generateFromPalette(d.data.vehicle);
                }
            }}
            borderColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 45,
                legend: 'Køretøjer',
                legendPosition: 'middle',
                legendOffset: 70,
                format: showValuesOnAxis ? undefined : () => '', // Empty string if showValuesOnAxis is false
                renderTick: ({ opacity, textAnchor, x, y, value }) => {
                    if (data.length > 26) {
                        return <></>;
                    }

                    const entry = data.find((d) => d.vehicle === value);

                    if (!entry) {
                        return <g transform={`translate(${x},${y})`} style={{ opacity }}></g>;
                    }

                    return (
                        <g transform={`translate(${x},${y})`} style={{ opacity }}>
                            <text textAnchor={textAnchor} transform="rotate(45)" fontSize={10}>
                                {getTspanGroups(entry)}
                            </text>
                        </g>
                    );
                },
            }}
            axisLeft={{
                tickValues: yTicks,
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Antal ture under maks tur distance',
                legendPosition: 'middle',
                legendOffset: -40,
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1.6]],
            }}
        />
    );
};

export default TripSegmentGraph;
