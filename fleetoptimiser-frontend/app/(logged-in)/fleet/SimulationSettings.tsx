import { Modal } from '@mui/material';
import { useState } from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import SettingsForm from '@/components/SimulationSettingsForm';
import { useAppSelector } from '@/components/redux/hooks';
import SettingsIcon from '@mui/icons-material/Settings';

const SimulationSettingsModal = () => {
    const [open, setOpen] = useState<boolean>(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const settings = useAppSelector((state) => state.simulation.settings.simulation_settings);

    return (
        <>
            <div onClick={handleOpen} className="flex flex-col text-sm font-semibold text-gray-700 w-12 items-center cursor-pointer">
                <SettingsIcon fontSize="large" className="text-blue-500 hover:text-blue-400 rounded-2xl p-1 bg-blue-100" />
                <span>Generelt</span>
            </div>
            <Modal open={open} onClose={handleClose} className="m-10 overflow-y-auto mx-auto flex items-center justify-center">
                <div className="relative bg-white p-4 rounded p-8 max-h-limit overflow-y-auto">
                    <div className="flex justify-between pb-2 mb-8">
                        <h1 className="text-2xl">Simuleringsindstillinger</h1>
                        <AiOutlineClose onClick={handleClose} size={30} className="cursor-pointer hover:text-blue-600" />
                    </div>
                    <SettingsForm initialValues={settings}></SettingsForm>
                </div>
            </Modal>
        </>
    );
};

export default SimulationSettingsModal;
