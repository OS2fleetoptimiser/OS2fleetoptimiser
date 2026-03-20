import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import {Button, Typography} from "@mui/material"

export interface ConfirmDeletionProps {
    open: boolean
    parkingType: string
    parkingId?: number
    setOpen: (open: boolean) => void
    handleDelete: (parkingType: string, parkingId?: number) => void
}

export function ConfirmDeletion(props: ConfirmDeletionProps) {
    const { setOpen, parkingType, parkingId, handleDelete, open } = props

    const handleClose = () => {
        setOpen(false)
    }

    const handleConfirm = () => {
        handleDelete(parkingType, parkingId)
        setOpen(false)
    }

    return (
        <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
            <DialogTitle>Slet parkeringspunkt</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    Er du sikker på, at du vil slette dette parkeringspunkt? Handlingen kan ikke fortrydes.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={handleClose}>
                    Annuller
                </Button>
                <Button variant="contained" color="error" onClick={handleConfirm}>
                    Slet
                </Button>
            </DialogActions>
        </Dialog>
    )
}
