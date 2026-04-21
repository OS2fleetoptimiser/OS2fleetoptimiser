import API from '@/components/AxiosBase';
import { DropDownData } from '@/components/hooks/useGetDropDownData';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, TextField, Typography } from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import { DatePicker } from '@mui/x-date-pickers';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';

type MoveRoundTripsDialogProps = {
    isOpen: boolean;
    onClose: (confirmed: boolean) => void;
    idValue?: number;
    plateValue?: string;
    makeValue?: string;
    modelValue?: string;
    locationAddress?: string;
    dropDownData: DropDownData;
};

const MoveRoundTripsDialog = ({ isOpen, onClose, idValue, plateValue, makeValue, modelValue, locationAddress, dropDownData }: MoveRoundTripsDialogProps) => {
    const today = dayjs();

    const [locationValue, setLocationValue] = useState(dropDownData.locations.filter((location) => location.address === locationAddress)[0]?.id);
    const [disableLocation, setDisableLocation] = useState(false);
    const [dateMove, setDateMove] = useState(today);

    const handleCancel = () => onClose(false);

    const handleConfirm = () => onClose(true);

    const queryClient = useQueryClient();

    const handleRequest = async () => {
        try {
            const response = await API.patch(
                `configuration/move-vehicle?vehicle_id=${idValue}&to_location=${locationValue}&from_date=${dateMove.format(
                    'YYYY-MM-DD'
                )}&disable=${disableLocation}`
            );
            if (response.status === 200) {
                await queryClient.invalidateQueries({
                    queryKey: ['vehicles']
                });
            }
        } catch (error: unknown) {
            console.log(error);
        }
        handleConfirm();
    };

    return (
        <Dialog open={isOpen} onClose={handleCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fcfcfc' }}>
                <Typography variant="h6" component="span">
                    Flyt eller slet rundture
                </Typography>
                <IconButton onClick={handleCancel} size="small" aria-label="luk">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 3 }}>
                <div className="space-y-4">
                    <div>
                        <Typography variant="subtitle2">
                            {plateValue ? plateValue + ' ' : null}
                            {makeValue ? makeValue + ' ' : null}
                            {modelValue ? modelValue : null}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Hvis køretøjet har flyttet lokation eller er afleveret, og det ikke er registreret i FleetOptimiser, kan det justeres med
                            tilbagevirkende kraft her. Vælg; 1) dato for flytning/aflevering, 2) lokation eller sletning af rundture.
                        </Typography>
                    </div>

                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <div className="p-4 space-y-3">
                            <TextField
                                fullWidth
                                size="small"
                                id="location.id"
                                name="location.id"
                                label="Flyt til lokation"
                                select
                                value={locationValue}
                                disabled={disableLocation}
                                onChange={(id) => setLocationValue(parseInt(id.target.value))}
                            >
                                {[...dropDownData.locations]
                                    .sort((a, b) => a.address.localeCompare(b.address))
                                    .map((location) => (
                                        <MenuItem key={location.id} value={location.id}>
                                            {location.address}
                                        </MenuItem>
                                    ))}
                            </TextField>
                            <DatePicker
                                format="DD-MM-YYYY"
                                label="Dato for ændring"
                                value={dateMove}
                                maxDate={today}
                                onChange={(newDate) => {
                                    setDateMove(newDate ? newDate : today);
                                }}
                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                            />
                        </div>
                    </Paper>

                    <FormGroup>
                        <FormControlLabel
                            control={<Checkbox color="error" onChange={(event) => setDisableLocation(event.target.checked)} />}
                            label="Slet Rundture & Deaktiver Køretøj"
                        />
                    </FormGroup>
                </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={handleCancel}>Annuller</Button>
                <Button variant="contained" color="primary" onClick={handleRequest}>Bekræft</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MoveRoundTripsDialog;
