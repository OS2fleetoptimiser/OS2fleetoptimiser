import { Button, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import ComparisonFleet from '@/app/(logged-in)/goal/ComparisonFleet';
import { useAppSelector } from '@/components/redux/hooks';

export const ComparisonFleetModal = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const vehicles = useAppSelector((state) => state.simulation.selectedVehicles);
    return (
        <div>
            <Button
                onClick={() => setIsOpen(true)}
                variant="outlined"
                color="inherit"
                startIcon={<BalanceOutlinedIcon />}
                size="small"
            >
                Sammenligningsflåde
            </Button>
            <Dialog open={isOpen} onClose={() => setIsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ bgcolor: '#fcfcfc', pb: 1 }}>
                    <div className="flex items-center justify-between">
                        <Typography variant="h6" component="span">
                            Sammenligningsflåde
                        </Typography>
                        <IconButton onClick={() => setIsOpen(false)} size="small" aria-label="luk">
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </div>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Flåden, som den automatiske simulering sammenligner med. Flåden er sammenstykket af de køretøjer, der har været aktive i den valgte datoperiode.
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 2 }}>
                    <ComparisonFleet vehicles={vehicles} />
                </DialogContent>
            </Dialog>
        </div>
    );
};
