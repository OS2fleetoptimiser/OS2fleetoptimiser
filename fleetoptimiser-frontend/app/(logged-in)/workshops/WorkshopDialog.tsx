'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, TextField } from '@mui/material';
import { Workshop } from '@/components/hooks/useGetWorkshops';
import { useSearchAddress } from '@/components/hooks/useAddressSearch';

const WorkshopMap = dynamic(() => import('@/app/(logged-in)/workshops/WorkshopMap'), {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height={240} />,
});

type Props = {
    open: boolean;
    workshop: Workshop | null; // null = create
    saving: boolean;
    onClose: () => void;
    onSave: (workshop: Workshop) => void;
};

type Position = {
    latitude: number;
    longitude: number;
};

type FormState = {
    id: number | null;
    name: string;
    address: string;
    savedPosition: Position | null;
};

const emptyForm: FormState = { id: null, name: '', address: '', savedPosition: null };

const toForm = (workshop: Workshop | null): FormState =>
    workshop
        ? {
              id: workshop.id,
              name: workshop.name ?? '',
              address: workshop.address ?? '',
              savedPosition: { latitude: workshop.latitude, longitude: workshop.longitude },
          }
        : emptyForm;

export default function WorkshopDialog({ open, workshop, saving, onClose, onSave }: Props) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <WorkshopForm workshop={workshop} saving={saving} onClose={onClose} onSave={onSave} />
        </Dialog>
    );
}

function WorkshopForm({ workshop, saving, onClose, onSave }: Omit<Props, 'open'>) {
    const [form, setForm] = useState<FormState>(() => toForm(workshop));
    const searchAddress = useSearchAddress();

    const foundAddress = searchAddress.data;
    const position = foundAddress
        ? { latitude: foundAddress.lat, longitude: foundAddress.lon }
        : form.savedPosition;

    const canSearch = !!form.address.trim() && !position && !searchAddress.isPending;
    const canSave = !!form.name.trim() && !!form.address.trim() && position !== null;

    const addressNotFound = searchAddress.isSuccess && foundAddress === null;
    const addressError = addressNotFound || searchAddress.isError;

    let addressHelperText: string | undefined;
    if (searchAddress.isError) {
        addressHelperText = 'Søgningen kunne ikke gennemføres. Prøv igen.';
    } else if (addressNotFound) {
        addressHelperText = 'Adressen blev ikke fundet. Tjek stavningen eller tilføj postnummer og by.';
    } else if (foundAddress) {
        addressHelperText = `Fundet: ${foundAddress.displayName}`;
    } else if (!position) {
        addressHelperText = 'Søg efter adressen for at finde placeringen.';
    }

    const handleAddressChange = (address: string) => {
        setForm({ ...form, address, savedPosition: null });
        searchAddress.reset();
    };

    const handleSearch = () => {
        if (!canSearch) return;
        searchAddress.mutate(form.address.trim());
    };

    const handleSave = () => {
        if (!canSave || !position) return;
        onSave({
            id: form.id,
            name: form.name.trim(),
            address: form.address.trim(),
            latitude: position.latitude,
            longitude: position.longitude,
            addition_date: workshop?.addition_date ?? null,
        });
    };

    return (
        <>
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
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                        <TextField
                            label="Adresse"
                            value={form.address}
                            onChange={(e) => handleAddressChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearch();
                            }}
                            error={addressError}
                            helperText={addressHelperText}
                            fullWidth
                            required
                        />
                        <Button
                            variant="outlined"
                            size="medium"
                            onClick={handleSearch}
                            disabled={!canSearch}
                            loading={searchAddress.isPending}
                        >
                            Søg
                        </Button>
                    </Stack>
                    {position && <WorkshopMap latitude={position.latitude} longitude={position.longitude} />}
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
        </>
    );
}
