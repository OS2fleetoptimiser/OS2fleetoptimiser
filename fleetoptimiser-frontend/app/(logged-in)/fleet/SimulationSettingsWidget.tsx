import { Button, Divider, Modal } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useState } from 'react';
import { Switch, Tooltip, FormControlLabel } from '@mui/material';
import OptimisationSettings from '@/app/(logged-in)/goal/optimisationSettings';
import CloseIcon from '@mui/icons-material/Close';
import SimulationSettingsModal from '@/app/(logged-in)/fleet/SimulationSettings';
import BikeSettingsModal from '@/app/(logged-in)/fleet/BikeSettings';
import ShiftModal from '@/app/(logged-in)/fleet/ShiftSettings';
import ExtraVehicleModal from '@/app/(logged-in)/fleet/ExtraVehiclesModal';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';

import { setIntelligentAllocation, setLimitKm } from '@/components/redux/SimulationSlice';

export const SimulationSettingsWidget = ({ manualSimulation }: { manualSimulation: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dispatch = useAppDispatch();

    const name = `${manualSimulation ? 'Simulerings' : 'Optimerings'}indstillinger`;
    const locationIds = useAppSelector((state) => state.simulation.location_ids);
    const [optimalAllocation, setOptimalAllocation] = useState<boolean>(useAppSelector((state) => state.simulation.intelligent_allocation));
    const [limitKm, setLimitKmLocal] = useState<boolean>(useAppSelector((state) => state.simulation.limit_km));
    const toggleIntelligent = () => {
        dispatch(setIntelligentAllocation(!optimalAllocation));
        setOptimalAllocation(!optimalAllocation);
    };
    const toggleLimit = () => {
        dispatch(setLimitKm(!limitKm));
        setLimitKmLocal(!limitKm);
    };

    return (
        <div>
            <Button
                onClick={() => setIsOpen(true)}
                className="mt-4 text-gray-700 border-gray-700"
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
                size="small"
            >
                {name}
            </Button>
            {isOpen && (
                <Modal open={isOpen} onClose={() => setIsOpen(false)}>
                    <div className="max-w-lg mx-auto p-4 bg-white rounded-lg shadow-md top-[50%] left-[50%] absolute transform -translate-x-1/2 -translate-y-1/2">
                        <label className="text-lg font-semibold text-black">{name}</label>
                        <div className="absolute top-4 right-4 cursor-pointer">
                            <CloseIcon onClick={() => setIsOpen(false)} fontSize="small" className="text-gray-500 hover:text-black" />
                        </div>
                        {!manualSimulation && (
                            <>
                                <div className="mb-6 mt-4">
                                    <OptimisationSettings />
                                </div>
                                <Divider />
                            </>
                        )}
                        <div className="my-4">
                            <div className="flex items-center justify-between text-sm font-bold text-black">
                                <span>Optimal tildeling</span>
                            </div>
                            <div className="flex sm:flex-row flex-col items-center">
                                <span className="text-xs text-gray-600 mb-2 mr-4">
                                    Aktiver optimal tildeling af køretøjer til rundeture for bedre udnyttelse i af din flåde.
                                </span>
                                <Tooltip
                                    title="Anvend intelligent allokering. Vær opmærksom på, at denne type simulering tager væsentlig længere tid. Intelligent allokering bygger på en algoritme der er optimeret til at håndtere 'enkelt-dags-ture', så hvis denne lokation har lange kørsler anbefales denne funktionalitet ikke."
                                    placement="top"
                                    arrow
                                >
                                    <FormControlLabel
                                        control={<Switch disabled={limitKm} onChange={toggleIntelligent} checked={optimalAllocation} color="primary" />}
                                        label=""
                                    />
                                </Tooltip>
                            </div>
                        </div>
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-sm font-bold text-black">
                                <span>Begræns km/år</span>
                            </div>
                            <div className="flex sm:flex-row flex-col items-center">
                                <span className="text-xs text-gray-600 mb-2 mr-4">
                                    Aktiver begrænsning af km for at overholde tilladte km-antal på leasingkontrakten.
                                </span>
                                <Tooltip
                                    title="Vil du anvende begrænsning af kilometer på dine køretøjer ift. antallet af kilometer på leasingaftalen, skal du benytte denne funktionalitet. Kan ikke benyttes sammen med intelligent allokering."
                                    placement="top"
                                    arrow
                                >
                                    <FormControlLabel
                                        control={<Switch disabled={optimalAllocation} onChange={toggleLimit} checked={limitKm} color="primary" />}
                                        label=""
                                    />
                                </Tooltip>
                            </div>
                        </div>
                        <Divider />
                        <div className="p-4 px-8 flex tiny:flex-row flex-wrap justify-between">
                            <ShiftModal locationIds={locationIds} />
                            <SimulationSettingsModal />
                            <BikeSettingsModal />
                            <ExtraVehicleModal />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
