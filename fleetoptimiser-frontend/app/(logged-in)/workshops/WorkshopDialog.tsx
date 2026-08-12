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

// coordinates are kept as strings so they can start out empty. defaulting them to 0
// would be a valid coordinate, so a forgotten field would save a workshop in the Gulf
// of Guinea that never matches a vehicle. it also keeps all four labels aligned, since
// an empty field renders its label unshrunk like the text fields do
type FormState = {
    id: number | null;
    name: string;
    address: string;
    latitude: string;
    longitude: string;
};

const emptyForm: FormState = { id: null, name: '', address: '', latitude: '', longitude: '' };

const toForm = (workshop: Workshop | null): FormState =>
    workshop
        ? {
              id: workshop.id,
              name: workshop.name ?? '',
              address: workshop.address ?? '',
              latitude: String(workshop.latitude),
              longitude: String(workshop.longitude),
          }
        : emptyForm;

export default function WorkshopDialog({ open, workshop, saving, onClose, onSave }: Props) {
    const [form, setForm] = useState<FormState>(emptyForm);

    useEffect(() => {
        setForm(toForm(workshop));
    }, [workshop, open]);

    const latitude = parseFloat(form.latitude);
    const longitude = parseFloat(form.longitude);
    const latValid = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
    const lonValid = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    const canSave = !!form.name.trim() && latValid && lonValid;

    // only complain about what the user has actually filled in; a still-empty required
    // field is signalled by the asterisk and the disabled save button
    const latError = form.latitude.trim() !== '' && !latValid;
    const lonError = form.longitude.trim() !== '' && !lonValid;

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            id: form.id,
            name: form.name.trim(),
            // '' rather than null, so clearing the address actually clears it: the
            // backend patch skips fields that arrive as null
            address: form.address.trim(),
            latitude: latitude,
            longitude: longitude,
            addition_date: workshop?.addition_date ?? null,
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{workshop ? 'Redigér værksted' : 'Tilføj værksted'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Navn"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Adresse"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        fullWidth
                    />
                    <TextField
                        label="Breddegrad"
                        type="number"
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                        error={latError}
                        helperText={latError ? 'Angiv en breddegrad mellem -90 og 90' : undefined}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Længdegrad"
                        type="number"
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                        error={lonError}
                        helperText={lonError ? 'Angiv en længdegrad mellem -180 og 180' : undefined}
                        fullWidth
                        required
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={onClose}>
                    Annuller
                </Button>
                <Button variant="contained" disabled={!canSave || saving} onClick={handleSave}>
                    Gem
                </Button>
            </DialogActions>
        </Dialog>
    );
}
