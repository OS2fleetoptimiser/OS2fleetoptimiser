import { useState } from 'react';
import { Button, CircularProgress, Tab, Tabs } from '@mui/material';
import NoSimulationResults from '@/app/(logged-in)/fleet/NoResults';
import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { SimResultHeader } from '@/app/(logged-in)/fleet/SimResultHeader';
import { FleetChangesTable } from '@/app/(logged-in)/fleet/FleetChangeTable';
import { UnallocatedTripsLineChart } from '@/app/(logged-in)/fleet/UnallocatedTripsLine';
import { VehicleTripDistribution } from '@/app/(logged-in)/fleet/VehicleTripDistribution';
import AxiosBase from '@/components/AxiosBase';
import DownloadIcon from '@mui/icons-material/Download';
import { DrivingBookTable } from '@/app/(logged-in)/fleet/DrivingBookPlan';
import { VehicleResults } from '@/app/(logged-in)/fleet/VehicleResults';

export const SimulationResultsPage = ({
    isLoading,
    simulationResults,
    simulationId,
}: {
    isLoading: boolean;
    simulationResults?: SimulationResults;
    simulationId?: string;
}) => {
    const [tabValue, setTabValue] = useState(0);
    // simulationId implies downloadable content, solutionNumber implies it's a goal simulation
    const baseUri = AxiosBase.getUri();
    const hasSolutionNumber = simulationResults?.solutionNumber !== undefined;
    const downloadLink = simulationId
        ? hasSolutionNumber
            ? `${baseUri}goal-simulation/simulation/${simulationId}?download=true&solution_index=${simulationResults.solutionNumber}`
            : `${baseUri}fleet-simulation/simulation/${simulationId}?download=true`
        : '';
    return (
        <div>
            {isLoading && (
                <div className="w-full h-full z-10 top-0 left-0 fixed bg-[#FFFFFF75]">
                    <div className="top-[40%] left-[50%] absolute transform -translate-x-1/2 -translate-y-1/2">
                        <CircularProgress />
                    </div>
                </div>
            )}
            <div className="w-auto rounded-lg m-auto">
                <div className="flex items-center justify-between">
                    <Tabs
                        value={tabValue}
                        onChange={(e, v) => setTabValue(v)}
                        aria-label="resultstabs"
                        variant="standard"
                        sx={{
                            minHeight: 36,
                            '& .MuiTab-root': {
                                minHeight: 36,
                                fontSize: '0.8125rem',
                            },
                        }}
                    >
                        <Tab label="Oversigt" value={0} />
                        <Tab
                            label="Køretøjsdetaljer"
                            disabled={!simulationResults}
                            value={1}
                        />
                        <Tab
                            label="Ruter"
                            disabled={!simulationResults}
                            value={2}
                        />
                    </Tabs>
                    {simulationId && (
                        <Button
                            href={downloadLink}
                            startIcon={<DownloadIcon />}
                            variant="outlined"
                            size="small"
                            download
                        >
                            Download
                        </Button>
                    )}
                </div>
                {tabValue === 0 && simulationResults && <ResultsOverviewTab simulationResults={simulationResults} />}
                {tabValue === 0 && !simulationResults && !isLoading && (
                    <div className="mt-8">
                        <NoSimulationResults />
                    </div>
                )}
                {tabValue === 1 && simulationResults && <VehicleResults simulationResults={simulationResults} />}
                {tabValue === 2 && simulationResults && <div className="mt-4"><DrivingBookTable data={simulationResults.drivingBook} /></div>}
            </div>
        </div>
    );
};

const ResultsOverviewTab = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    return (
        <div className="mt-4 space-y-6">
            <SimResultHeader simulationResults={simulationResults} />
            <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6">
                <FleetChangesTable simulationResults={simulationResults} />
                <UnallocatedTripsLineChart simulationResults={simulationResults} />
            </div>
            <VehicleTripDistribution simulationResults={simulationResults} />
        </div>
    );
};
