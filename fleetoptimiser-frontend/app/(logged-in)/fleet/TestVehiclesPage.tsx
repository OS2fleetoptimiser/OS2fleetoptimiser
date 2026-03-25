import { Button, CircularProgress, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useState } from 'react';
import ExtraVehicleTable from '@/app/(logged-in)/fleet/ExtraVehicleTable';
import ApiError from '@/components/ApiError';
import useGetUniqueVehicles from '@/components/hooks/useGetUniqueVehicles';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { clearExtraVehicles, clearTestVehicles } from '@/components/redux/SimulationSlice';
import { filterPreselectedVehicles, filterVehiclesBySearch } from './vehicleFilters';

export const TestVehiclesPage = ({ onCreateClick }: { onCreateClick?: () => void }) => {
    const dispatch = useAppDispatch();
    const [searchQuery, setSearchQuery] = useState('');
    const cars = useGetUniqueVehicles();
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
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1">
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
                        {onCreateClick && (
                            <Button variant="outlined" size="small" onClick={onCreateClick} startIcon={<AddIcon />}>
                                Opret nyt testkøretøj
                            </Button>
                        )}
                    </div>
                    <ExtraVehicleTable
                        cars={filterVehiclesBySearch(
                            filterPreselectedVehicles(cars.data, selectedVehicles),
                            searchQuery
                        )}
                    />
                    <div className="flex items-center">
                        <Button variant="outlined" color="error" size="small" onClick={clearAllVehicles} startIcon={<RemoveCircleOutlineIcon />}>
                            Fjern alle
                        </Button>
                    </div>
                </>
            )}
        </>
    );
};
