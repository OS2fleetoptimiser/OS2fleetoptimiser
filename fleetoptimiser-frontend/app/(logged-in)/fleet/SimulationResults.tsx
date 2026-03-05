import { useState } from 'react';
import { CircularProgress, IconButton, Tab, Tabs } from '@mui/material';
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
            <div className="w-auto rounded-md m-auto">
                <div className="flex items-center gap-2">
                    <Tabs
                        value={tabValue}
                        onChange={(e, v) => setTabValue(v)}
                        aria-label="resultstabs"
                        TabIndicatorProps={{
                            hidden: true,
                        }}
                        sx={{
                            '& .MuiTabs-flexContainer': {
                                backgroundColor: '#f5f5f5',
                                borderRadius: '5px',
                                padding: '6px',
                                width: 'fit-content',
                                height: '35px',
                            },
                            '& .MuiTab-root': {
                                borderRadius: '5px',
                                backgroundColor: '#f5f5f5',
                                color: 'gray',
                                minWidth: 120,
                                minHeight: 20,
                                padding: '6px 6px',
                                '&:hover': {
                                    backgroundColor: '#e0e0e0',
                                },
                            },
                            '& .MuiTab-root.Mui-selected': {
                                backgroundColor: 'white',
                                color: 'black',
                                fontWeight: 'bold',
                            },
                        }}
                    >
                        <Tab
                            label="Oversigt"
                            value={0}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: 'white',
                                },
                            }}
                        />
                        <Tab
                            label="Køretøjsdetaljer"
                            disabled={!simulationResults}
                            value={1}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: 'white',
                                },
                            }}
                        />
                        <Tab
                            label="Ruter"
                            disabled={!simulationResults}
                            value={2}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: 'white',
                                },
                            }}
                        />
                    </Tabs>
                    {simulationId && (
                        <IconButton href={downloadLink} disabled={!simulationId} className="border-none text-gray-700 hover:text-black" download>
                            <DownloadIcon fontSize="small" />
                        </IconButton>
                    )}
                </div>
                {tabValue === 0 && simulationResults && <ResultsOverviewTab simulationResults={simulationResults} />}
                {tabValue === 0 && !simulationResults && !isLoading && (
                    <div className="mt-8">
                        <NoSimulationResults />
                    </div>
                )}
                {tabValue === 1 && simulationResults && <VehicleResults simulationResults={simulationResults} />}
                {tabValue === 2 && simulationResults && <DrivingBookTable data={simulationResults.drivingBook} />}
            </div>
        </div>
    );
};

const ResultsOverviewTab = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    return (
        <div className="mt-4 space-y-6">
            <SimResultHeader simulationResults={simulationResults} />
            <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6 h-auto xl:h-96">
                <FleetChangesTable simulationResults={simulationResults} />
                <UnallocatedTripsLineChart simulationResults={simulationResults} />
            </div>
            <VehicleTripDistribution simulationResults={simulationResults} />
        </div>
    );
};
