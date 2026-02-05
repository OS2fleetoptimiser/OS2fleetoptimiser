'use client';

import useGetDrivingData from '@/components/hooks/useGetDrivingData';
import { CircularProgress, TextField } from '@mui/material';
import dayjs from 'dayjs';
import ApiError from '@/components/ApiError';
import { useState } from 'react';
import TimeActivityHeatMap from './TimeActivityHeatMap';
import { filterProps } from '../../(filters)/FilterHeader';
import { DownloadableGraph } from '@/components/DownloadableGraph';

function TimeActivityDashboard({ end, locations, forvaltninger, start, departments, vehicles, shifts }: filterProps) {
    const [colorThreshold, setColorThreshold] = useState<number>(20);
    const { queryObject: heatMapData } = useGetDrivingData({
        startPeriod: start ? dayjs(start) : dayjs().add(-7, 'day'),
        endPeriod: end ? dayjs(end) : dayjs(),
        locationIds: locations,
        departments: departments,
        forvaltninger: forvaltninger,
        vehicleIds: vehicles,
        asTripSegments: false,
        shiftFilter: shifts,
        timeDelta: true,
        selector: (data0) => {
            let timeDelta = data0.timedelta;
            let result = [];
            const date = dayjs(data0.query_end_date);
            const vName = data0.query_vehicles.reduce((a, v) => {
                a[v.id] = v.name;
                return a;
            }, {} as { [id: number]: string });

            for (const id in vName) {
                let data = [];
                let date0 = dayjs(data0.query_start_date);

                do {
                    const dateString = date0.toDate().toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                    });
                    data.push({ x: dateString, y: timeDelta?.[id]?.[dateString]?.['timeSpent'] / timeDelta?.[id]?.[dateString]?.['timePossible'] });
                    date0 = date0.add(1, 'day');
                } while (!date0.isSame(date, 'days'));

                result.push({ id: vName[id], data: data });
            }

            return result;
        },
    });
    const fileNameAppendix = `${start}-${end}-${locations?.length ?? 'alle'}_lokationer-${vehicles?.length ?? 'alle'}_koeretoejer`;
    const impliedCellHeight = 40
    const impliedBaseHeight = 210
    const computedHeight = impliedBaseHeight + ((heatMapData.data?.length || 1) * impliedCellHeight);
    return (
        <div>
            <>
                <div className="flex items-center py-8">
                    <TextField
                        label="Grænseværdi"
                        id="outlined-start-adornment"
                        sx={{ m: 1, width: '25ch' }}
                        className="ml-4 subtle w-40"
                        type={'number'}
                        value={colorThreshold}
                        onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            setColorThreshold(isNaN(value) || value < 0 || value > 100 ? colorThreshold : value);
                        }}
                    />
                    <p className="text-explanation text-xs ml-4 block w-96">
                        Tidsaktivitet viser den procentvise udnyttelse af køretøjerne i den valgte periode pr. dag. 100% indikerer at køretøjet har været aktiv
                        i rundtur i hele perioden. Justér grænseværdien for at fremhæve lavere eller højere udnyttelse af køretøjerne.
                    </p>
                </div>

                {heatMapData.isPending && (
                    <div className="p-10 flex justify-center">
                        <CircularProgress />
                    </div>
                )}
                {heatMapData.data && (
                    <div style={{height: `${computedHeight}px`}}>
                        <DownloadableGraph filename={`tidsaktivitet-${fileNameAppendix}.png`}>
                            <TimeActivityHeatMap data={heatMapData.data} threshold={colorThreshold} />
                        </DownloadableGraph>
                    </div>
                )}
                {heatMapData.isError && (
                    <ApiError
                        retryFunction={() => {
                            if (heatMapData.isError) heatMapData.refetch();
                        }}
                    >
                        Der opstod en netværksfejl
                    </ApiError>
                )}
            </>
        </div>
    );
}

export default TimeActivityDashboard;
