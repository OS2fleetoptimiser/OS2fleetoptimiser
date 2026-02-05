import { Button, CircularProgress, Modal } from '@mui/material';
import { useState } from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import TestVehicleTable from './TestVehicleTable';
import ApiError from '@/components/ApiError';
import useGetVehicles, { Vehicle } from '@/components/hooks/useGetVehicles';
import ToolTip from '@/components/ToolTip';
import {useAppDispatch, useAppSelector} from '@/components/redux/hooks';
import {addTestVehicles, addTestVehiclesMeta, clearTestVehicles} from '@/components/redux/SimulationSlice';
import {reduceDuplicateVehicles} from "@/components/DuplicateReducer";
import IconTextCard from "@/components/IconCard";
import CommuteIcon from "@mui/icons-material/Commute";

const TestVehicleModal = () => {
    const [open, setOpen] = useState<boolean>(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const dispatch = useAppDispatch();

    const cars = useGetVehicles((data) => {
            const criteriaMetVehicles = data.vehicles.reduce((acc: Vehicle[], cur) => {
                const meetsConditions =
                    cur.omkostning_aar != null && // has omkostning filled
                    (cur.wltp_el != null ||
                        cur.wltp_fossil != null || // has wltp filled
                        ((cur.type?.id === 1 || cur.type?.id === 2) && cur.fuel?.id === 10)); // is a bike

                const carExists = acc.find(
                    (car) =>
                        car.make === cur.make &&
                        car.model === cur.model &&
                        car.wltp_fossil === cur.wltp_fossil &&
                        car.wltp_el === cur.wltp_el &&
                        car.omkostning_aar === cur.omkostning_aar
                );

                if (meetsConditions && !carExists) {
                    acc.push(cur);
                }

                return acc
            }, [])
            return reduceDuplicateVehicles(criteriaMetVehicles).map(veh => veh.vehicle);
        }
    );
    const selectedTestVehicles = useAppSelector((state) => state.simulation.goalSimulationSettings?.testVehicles ?? cars)

    return (
        <>
            <IconTextCard icon={<CommuteIcon/>} text={`Testkøretøjer (${selectedTestVehicles.length === 0 ? (cars.data ? cars.data.length : 0) : (selectedTestVehicles.length)})`} onClick={handleOpen}/>
            <Modal open={open} onClose={handleClose} className="m-10 overflow-scroll lg:mx-96">
                <div className="bg-white p-4">
                    <div className="flex justify-between border-b pb-2 mb-2">
                        <h1 className="text-2xl">
                            Vælg Testkøretøjer
                            <ToolTip>
                                Hvis du vil teste mod specifikke køretøjer, kan du vælge dem her. Hvis du ikke vælger nogen, har algoritmen
                                adgang til at bruge alle køretøjer i databasen.
                            </ToolTip>
                        </h1>
                        <AiOutlineClose onClick={handleClose} size={30} className="cursor-pointer hover:text-blue-600" />
                    </div>
                    {cars.isError && <ApiError retryFunction={cars.refetch}>Testkøretøjerne kunne ikke hentes.</ApiError>}
                    {cars.isPending && <CircularProgress />}
                    {cars.data && (
                        <>
                            <div className="flex justify-end">
                                <Button className="mx-2" onClick={() => {
                                    dispatch(addTestVehicles(cars.data.map((car) => car.id)))
                                    dispatch(addTestVehiclesMeta(cars.data))
                                }
                                }>
                                    Tilføj alle
                                </Button>
                                <Button className="mx-2" onClick={() => dispatch(clearTestVehicles())}>
                                    Fjern alle
                                </Button>
                            </div>
                            <TestVehicleTable cars={cars.data}></TestVehicleTable>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default TestVehicleModal;
