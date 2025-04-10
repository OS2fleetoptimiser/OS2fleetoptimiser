import { Button, Modal } from '@mui/material';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import ToolTip from '@/components/ToolTip';
import ComparisonFleet from '@/app/(logged-in)/goal/ComparisonFleet';
import { useAppSelector } from '@/components/redux/hooks';

export const ComparisonFleetModal = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const vehicles = useAppSelector((state) => state.simulation.selectedVehicles);
    return (
        <div>
            <Button
                onClick={() => setIsOpen(true)}
                className="mt-4 text-gray-700 border-gray-700"
                variant="outlined"
                startIcon={<BalanceOutlinedIcon />}
                size="small"
            >
                Sammenligningsflåde
            </Button>
            {isOpen && (
                <Modal open={isOpen} onClose={() => setIsOpen(false)} className="mt-10 max-w-[1000px] m-auto">
                    <div className="bg-white p-4 w-full rounded-md max-h-[calc(100vh-200px)] overflow-auto">
                        <div className="flex items-center">
                            <label className="text-lg font-semibold text-black">Sammenligningsflåde</label>
                            <ToolTip>
                                Flåden som den automatiske simulering sammenligner med. Flåden er sammenstykket af de køretøjer der har været aktive i den
                                valgte datoperiode.
                            </ToolTip>
                        </div>
                        <div className="absolute top-4 right-4 cursor-pointer">
                            <CloseIcon onClick={() => setIsOpen(false)} fontSize="small" className="text-gray-500 hover:text-black" />
                        </div>
                        <ComparisonFleet vehicles={vehicles} />
                    </div>
                </Modal>
            )}
        </div>
    );
};
