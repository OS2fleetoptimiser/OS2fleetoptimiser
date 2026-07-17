'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Workshop } from '@/components/hooks/useGetWorkshops';

type Props = {
    open: boolean;
    workshop: Workshop | null; // null = create
    saving: boolean;
    onClose: () => void;
    onSave: (workshop: Workshop) => void;
};

const emptyWorkshop: Workshop = {
    id: null,
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    addition_date: null,
};

export default function WorkshopDialog({ open, workshop, saving, onClose, onSave }: Props) {
    const [form, setForm] = useState<Workshop>(emptyWorkshop);

    useEffect(() => {
        setForm(workshop ?? emptyWorkshop);
    }, [workshop, open]);

    const latValid = !Number.isNaN(form.latitude) && form.latitude >= -90 && form.latitude <= 90;
    const lonValid = !Number.isNaN(form.longitude) && form.longitude >= -180 && form.longitude <= 180;
    const canSave = !!form.name?.trim() && latValid && lonValid;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{workshop ? 'Redigér værksted' : 'Tilføj værksted'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Navn"
                        value={form.name ?? ''}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Adresse"
                        value={form.address ?? ''}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        fullWidth
                    />
                    <TextField
                        label="Breddegrad"
                        type="number"
                        value={Number.isNaN(form.latitude) ? '' : form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })}
                        error={!latValid}
                        helperText={!latValid ? 'Angiv en breddegrad mellem -90 og 90' : undefined}
                        fullWidth
                    />
                    <TextField
                        label="Længdegrad"
                        type="number"
                        value={Number.isNaN(form.longitude) ? '' : form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })}
                        error={!lonValid}
                        helperText={!lonValid ? 'Angiv en længdegrad mellem -180 og 180' : undefined}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={onClose}>
                    Annuller
                </Button>
                <Button variant="contained" disabled={!canSave || saving} onClick={() => onSave(form)}>
                    Gem
                </Button>
            </DialogActions>
        </Dialog>
    );
}
