import patchVehicle from '@/components/hooks/patchVehicle';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';

type props = {
    open: boolean;
    handleClose: () => void;
    vehicle: Vehicle;
};

const DisableVehicleDialog = ({ open, handleClose, vehicle }: props) => {
    const queryClient = useQueryClient();

    const updateVehicle = async () => {
        await patchVehicle({ ...vehicle, disabled: !vehicle.disabled });
        queryClient.invalidateQueries({
            queryKey: ['vehicles']
        });
        handleClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>{vehicle.disabled ? 'Aktiver' : 'Deaktiver'} køretøj</DialogTitle>
            <DialogContent sx={{ '&&': { pt: 1 } }}>
                <Typography variant="body2" color="text.secondary">
                    {vehicle.disabled
                        ? `Når køretøjet bliver aktiveret vil FleetOptimiser begynde at indsamle kørselsdata for det. Er du sikker på at du vil aktivere dette køretøj (${vehicle.plate})?`
                        : `Når køretøjer er deaktiverede bliver der ikke hentet kørselsdata for dem. Er du sikker på at du vil deaktivere dette køretøj (${vehicle.plate})?`}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={handleClose}>Annuller</Button>
                <Button variant="contained" color="primary" onClick={updateVehicle}>Bekræft</Button>
            </DialogActions>
        </Dialog>
    );
};

export default DisableVehicleDialog;
