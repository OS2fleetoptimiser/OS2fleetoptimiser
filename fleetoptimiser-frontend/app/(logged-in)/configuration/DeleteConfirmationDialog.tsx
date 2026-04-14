import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

type DeleteConfirmationDialogProps = {
    isOpen: boolean;
    onClose: (confirmed: boolean) => void;
    idValue?: number;
    plateValue?: string;
    makeValue?: string;
    modelValue?: string;
};

const DeleteConfirmationDialog = ({ isOpen, onClose, idValue, plateValue, makeValue, modelValue }: DeleteConfirmationDialogProps) => {
    const handleCancel = () => onClose(false);

    const handleConfirm = () => onClose(true);

    return (
        <Dialog open={isOpen} onClose={handleCancel} maxWidth="xs" fullWidth>
            <DialogTitle>Slet Køretøj</DialogTitle>
            <DialogContent sx={{ '&&': { pt: 1 } }}>
                <Typography variant="body2" color="text.secondary">
                    Er du sikker på at du vil slette?
                </Typography>
                <Typography variant="body2" color="text.secondary" component="ul" sx={{ mt: 1, pl: 2 }}>
                    <li>ID: {idValue}</li>
                    {plateValue ? <li>Nummerplade: {plateValue}</li> : null}
                    {makeValue ? <li>Mærke: {makeValue}</li> : null}
                    {modelValue ? <li>Model: {modelValue}</li> : null}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={handleCancel}>Annuller</Button>
                <Button variant="contained" color="error" onClick={handleConfirm}>Slet</Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmationDialog;
