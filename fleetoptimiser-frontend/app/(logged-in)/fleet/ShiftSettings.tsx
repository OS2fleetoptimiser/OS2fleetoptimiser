import { Button, Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { ShiftForm } from '@/components/ShiftSettingsForm';
import { useAppSelector } from '@/components/redux/hooks';
import { shift_settings } from '@/components/hooks/useGetSettings';
import AccessTimeIcon from "@mui/icons-material/AccessTime";

const ShiftModal = ({ locationId, buttonText, locationIds }: { locationId?: number; buttonText?: string; locationIds?: number[] }) => {
    const [open, setOpen] = useState<boolean>(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const singleLocationShifts = useAppSelector(
        (state) =>
            state.simulation.settings.shift_settings.find((s) => s.location_id === locationId) || {
                location_id: locationId,
                shifts: [],
            }
    );

    const allLocationShifts = useAppSelector((state) => {
        const { location_ids, settings } = state.simulation;

        return (location_ids || []).reduce((acc: Record<number, shift_settings>, locId) => {
            const shiftSetting = settings.shift_settings.find((s) => s.location_id === locId);
            acc[locId] = shiftSetting || { location_id: locId, shifts: [], address: '' };
            return acc;
        }, {});
    });

    return (
        <>
            {buttonText && <Button onClick={handleOpen} variant="outlined" size="small">Indstil vagtlag</Button>}
            {!buttonText && <div onClick={handleOpen}
                  className="flex flex-col text-sm font-semibold text-gray-700 w-12 items-center cursor-pointer">
                <AccessTimeIcon fontSize="large"
                                className="text-blue-500 hover:text-blue-400 rounded-2xl p-1 bg-blue-100"/>
                <span>Vagtlag</span>
            </div>}
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fcfcfc' }}>
                    <Typography variant="h6" component="span">Vagtlagsindstillinger</Typography>
                    <IconButton onClick={handleClose} size="small" aria-label="luk">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 3 }}>
                    <div className="space-y-4">
                        {locationId && (
                            <ShiftForm locationId={locationId} shifts={singleLocationShifts.shifts} />
                        )}
                        {!locationId && locationIds && locationIds.map((locId) => (
                            <ShiftForm
                                key={'ShiftFormKey' + locId}
                                locationId={allLocationShifts[locId].location_id}
                                shifts={allLocationShifts[locId].shifts}
                                addressName={allLocationShifts[locId].address}
                                closeIt={handleClose}
                            />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ShiftModal;
