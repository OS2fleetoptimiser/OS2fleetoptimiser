import API from '@/components/AxiosBase';
import { DropDownData } from '@/components/hooks/useGetDropDownData';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, TextField } from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';

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
        const values = {
            vehicle_id: idValue,
            from_date: dateMove,
            to_location: disableLocation ? null : locationValue,
            disable: disableLocation,
        };
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
        <Dialog open={isOpen} onClose={handleCancel}>
            <DialogTitle>Flyt eller slet rundture</DialogTitle>
            <DialogContent>
                <DialogContentText component="div">
                    <form>
                        <div className="container mx-auto my-4 p-4">
                            <div className="mb-4">
                                <b>
                                    {plateValue ? plateValue + ' ' : null}
                                    {makeValue ? makeValue + ' ' : null}
                                    {modelValue ? modelValue : null}
                                </b>
                            </div>
                            <div className="mb-4">
                                <p>
                                    Hvis køretøjet har flyttet lokation eller er afleveret, og det ikke er registreret i FleetOptimiser, kan det justeres med
                                    tilbagevirkende kraft her. Vælg; 1) dato for flytning/aflevering, 2) lokation eller sletning af rundture.
                                </p>
                            </div>
                            <div className="flex items-center mb-4">
                                <div className="w-1/3 pr-4">Flyt til:</div>
                                <div className="w-2/3">
                                    <TextField
                                        className="w-full"
                                        id="location.id"
                                        name="location.id"
                                        label="Lokation"
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
                                </div>
                            </div>
                            <div className="flex items-center mb-4">
                                <div className="w-1/3 pr-4">Dato for ændring:</div>
                                <div className="w-2/3">
                                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="da">
                                        <DatePicker
                                            format="DD-MM-YYYY"
                                            label="Flytte - eller slettedato"
                                            value={dateMove}
                                            maxDate={today}
                                            onChange={(newDate) => {
                                                setDateMove(newDate ? newDate : today);
                                            }}
                                        />
                                    </LocalizationProvider>
                                </div>
                            </div>
                            <div className="mb-4">
                                <FormGroup>
                                    <FormControlLabel
                                        control={<Checkbox color="error" onChange={(event) => setDisableLocation(event.target.checked)} />}
                                        label="Slet Rundture & Deaktiver Køretøj"
                                    />
                                </FormGroup>
                            </div>
                        </div>
                    </form>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel}>Annuller</Button>
                <Button onClick={handleRequest} autoFocus>
                    Bekræft
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MoveRoundTripsDialog;
