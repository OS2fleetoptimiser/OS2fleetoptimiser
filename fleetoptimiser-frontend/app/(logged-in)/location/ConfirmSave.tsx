import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import {Button, Typography} from "@mui/material"
import {useState} from "react"

export interface ConfirmSaveProps {
    disabled: boolean
    buttonText: string
    handleSave: () => void
}

export function ConfirmSave(props: ConfirmSaveProps) {
    const [open, setOpen] = useState<boolean>(false)
    const { disabled, buttonText, handleSave } = props

    const handleClose = () => {
        setOpen(false)
    }

    const handleConfirm = () => {
        handleSave()
        setOpen(false)
    }

    return (
        <>
            <Button
                variant="contained"
                color="primary"
                disabled={disabled}
                onClick={() => setOpen(true)}
            >
                {buttonText}
            </Button>
            <Dialog onClose={handleClose} open={open} maxWidth="xs" fullWidth>
                <DialogTitle>Bekræft</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Er du sikker på, at du vil gemme ændringerne?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button variant="text" color="inherit" onClick={handleClose}>
                        Annuller
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleConfirm}>
                        Gem
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
