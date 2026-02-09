import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

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
        <Dialog open={isOpen} onClose={handleCancel}>
            <DialogTitle>Slet Køretøj</DialogTitle>
            <DialogContent>
                <DialogContentText component="div">
                    Er du sikker på at du vil slette?
                    <div className="mt-3">
                        <ul>
                            <li>ID: {idValue}</li>
                            {plateValue ? <li>Nummerplade: {plateValue}</li> : null}
                            {makeValue ? <li>Mærke: {makeValue}</li> : null}
                            {modelValue ? <li>Model: {modelValue}</li> : null}
                        </ul>
                    </div>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel}>Annuller</Button>
                <Button onClick={handleConfirm} autoFocus>
                    Bekræft
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteConfirmationDialog;
