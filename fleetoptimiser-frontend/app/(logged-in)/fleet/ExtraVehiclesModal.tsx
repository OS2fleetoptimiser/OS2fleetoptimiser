import { Button, CircularProgress, Modal, TextField } from '@mui/material';
import { useState } from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import SearchIcon from '@mui/icons-material/Search';
import ApiError from '@/components/ApiError';
import ExtraVehicleTable from './ExtraVehicleTable';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import useGetUniqueVehicles from '@/components/hooks/useGetUniqueVehicles';
import { clearExtraVehicles, clearTestVehicles } from '@/components/redux/SimulationSlice';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AddIcon from '@mui/icons-material/Add';
import useGetDropDownData from '@/components/hooks/useGetDropDownData';
import VehicleModal from '@/app/(logged-in)/configuration/CreateOrUpdateVehicle';

const ExtraVehicleModal = ({ buttonAppearance = false }: { buttonAppearance?: boolean }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [showVehicleModal, setShowVehicleModal] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const { data: dropDownData, isFetching } = useGetDropDownData();

    const dispatch = useAppDispatch();

    const cars = useGetUniqueVehicles();
    const selectedVehicles = useAppSelector((state) => state.simulation.selectedVehicles);

    const filterPreselectedVehicles = (availableVehicles: Vehicle[], selectedVehicles: Vehicle[]) =>
        availableVehicles.filter((v) => {
            // vehicle has omkostning filled and either wltp_el or wltp_fossil if it's not a bike
            const meetsConditions =
                v.omkostning_aar != null && (v.wltp_el != null || v.wltp_fossil != null || ((v.type?.id === 1 || v.type?.id === 2) && v.fuel?.id === 10));

            const isNotSelected = !selectedVehicles.find(
                (car) =>
                    car.make === v.make &&
                    car.model === v.model &&
                    car.omkostning_aar === v.omkostning_aar &&
                    car.wltp_el === v.wltp_el &&
                    car.wltp_fossil === v.wltp_fossil
            );

            return meetsConditions && isNotSelected;
        });

    const filterVehiclesBySearch = (vehicles: Vehicle[], query: string) => {
        if (!query.trim()) {
            return vehicles;
        }
        const lowerQuery = query.toLowerCase();
        return vehicles.filter((v) => {
            const make = v.make?.toLowerCase() || '';
            const model = v.model?.toLowerCase() || '';
            return make.includes(lowerQuery) || model.includes(lowerQuery);
        });
    };

    const clearAllVehicles = () => {
        dispatch(clearExtraVehicles());
        dispatch(clearTestVehicles()); // one component for both manual and automatic sim
    };
    return (
        <>
            {buttonAppearance && (
                <Button size="small" onClick={handleOpen} variant="outlined" className="text-black border-black" startIcon={<AddIcon />}>
                    Tilføj testkøretøj
                </Button>
            )}
            {!buttonAppearance && (
                <div onClick={handleOpen} className="flex flex-col text-sm font-semibold text-gray-700 w-12 items-center cursor-pointer">
                    <DirectionsCarIcon fontSize="large" className="text-blue-500 hover:text-blue-400 rounded-2xl p-1 bg-blue-100" />
                    <span>Testkøretøjer</span>
                </div>
            )}
            <Modal open={open} onClose={handleClose} className="m-10 overflow-scroll lg:mx-96 rounded-md">
                <div className="bg-white p-4 w-full ">
                    <div className="flex justify-between pb-2 mb-2">
                        <span className="text-xl font-semibold">Tilføj køretøjer til simulering</span>
                        <AiOutlineClose onClick={handleClose} size={30} className="cursor-pointer hover:text-blue-600" />
                    </div>

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
                                cars={filterVehiclesBySearch(filterPreselectedVehicles(cars.data, selectedVehicles), searchQuery)}
                            ></ExtraVehicleTable>
                            <div className="flex justify-between items-center">
                                <Button variant="outlined" onClick={() => setShowVehicleModal(true)} endIcon={<AddIcon />}>
                                    Opret nyt testkøretøj
                                </Button>

                                {/*  no scenario for adding all test = 0 selected implies all  */}
                                <Button variant="outlined" onClick={clearAllVehicles}>
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
                </div>
            </Modal>
        </>
    );
};

export default ExtraVehicleModal;
