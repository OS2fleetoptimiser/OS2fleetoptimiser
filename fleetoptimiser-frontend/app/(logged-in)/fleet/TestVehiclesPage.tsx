import { Button, CircularProgress, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { useState } from 'react';
import ExtraVehicleTable from '@/app/(logged-in)/fleet/ExtraVehicleTable';
import ApiError from '@/components/ApiError';
import useGetUniqueVehicles from '@/components/hooks/useGetUniqueVehicles';
import useGetDropDownData from '@/components/hooks/useGetDropDownData';
import VehicleModal from '@/app/(logged-in)/configuration/CreateOrUpdateVehicle';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { clearExtraVehicles, clearTestVehicles } from '@/components/redux/SimulationSlice';
import { filterPreselectedVehicles, filterVehiclesBySearch } from './vehicleFilters';

export const TestVehiclesPage = () => {
    const dispatch = useAppDispatch();
    const [searchQuery, setSearchQuery] = useState('');
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const cars = useGetUniqueVehicles();
    const { data: dropDownData, isFetching } = useGetDropDownData();
    const selectedVehicles = useAppSelector((state) => state.simulation.selectedVehicles);

    const clearAllVehicles = () => {
        dispatch(clearExtraVehicles());
        dispatch(clearTestVehicles());
    };

    return (
        <>
            {cars.isError && <ApiError retryFunction={cars.refetch}>Køretøjerne kunne ikke hentes.</ApiError>}
            {cars.isPending && <CircularProgress />}
            {cars.data && (
                <>
                    <div className="max-w-sm mb-2">
                        <TextField
                            fullWidth
                            placeholder="Søg efter køretøj (mærke eller model)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            variant="outlined"
                            size="small"
                            slotProps={{
                                input: {
                                    startAdornment: <SearchIcon className="mr-2 text-gray-400" />,
                                }
                            }}
                        />
                    </div>
                    <ExtraVehicleTable
                        cars={filterVehiclesBySearch(
                            filterPreselectedVehicles(cars.data, selectedVehicles),
                            searchQuery
                        )}
                    />
                    <div className="flex justify-between items-center">
                        <Button variant="outlined" size="small" onClick={() => setShowVehicleModal(true)} endIcon={<AddIcon />}>
                            Opret nyt testkøretøj
                        </Button>
                        <Button variant="outlined" size="small" onClick={clearAllVehicles}>
                            Fjern alle
                        </Button>
                    </div>
                </>
            )}
            {showVehicleModal && !isFetching && dropDownData && (
                <VehicleModal
                    onClose={() => setShowVehicleModal(false)}
                    submit={() => null}
                    open={showVehicleModal}
                    dropDownData={dropDownData}
                    isUpdate={false}
                />
            )}
        </>
    );
};
