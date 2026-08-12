'use client';

import { useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Skeleton,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { daDK } from '@mui/x-data-grid/locales';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitle from '@/components/PageTitle';
import ApiError from '@/components/ApiError';
import { useWritePrivilegeContext } from '@/app/providers/WritePrivilegeProvider';
import {
    Workshop,
    useCreateWorkshop,
    useDeleteWorkshop,
    useGetWorkshopSettings,
    useGetWorkshops,
    useUpdateWorkshop,
    useUpdateWorkshopSettings,
} from '@/components/hooks/useGetWorkshops';
import WorkshopDialog from '@/app/(logged-in)/workshops/WorkshopDialog';

export default function Page() {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { data: workshops, isPending, isError, refetch } = useGetWorkshops();
    const { data: settings, isError: settingsError } = useGetWorkshopSettings();

    const createWorkshop = useCreateWorkshop();
    const updateWorkshop = useUpdateWorkshop();
    const deleteWorkshop = useDeleteWorkshop();
    const updateSettings = useUpdateWorkshopSettings();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Workshop | null>(null);
    const [deleteId, setDeleteId] = useState<number | undefined>(undefined);
    // null means untouched, so the loaded value shows; '' is a field the user cleared
    const [minHours, setMinHours] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

    const minHoursValue = minHours ?? (settings ? String(settings.min_visit_hours) : '');

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (workshop: Workshop) => {
        setEditing(workshop);
        setDialogOpen(true);
    };

    const handleSave = (workshop: Workshop) => {
        const mutation = workshop.id ? updateWorkshop : createWorkshop;
        mutation.mutate(workshop, {
            onSuccess: () => {
                setDialogOpen(false);
                setToast({ msg: workshop.id ? 'Værksted opdateret' : 'Værksted oprettet', severity: 'success' });
            },
            onError: () => setToast({ msg: 'Kunne ikke gemme værkstedet', severity: 'error' }),
        });
    };

    const handleDelete = () => {
        if (deleteId == null) return;
        deleteWorkshop.mutate(deleteId, {
            onSuccess: () => setToast({ msg: 'Værksted slettet', severity: 'success' }),
            onError: () => setToast({ msg: 'Kunne ikke slette værkstedet', severity: 'error' }),
        });
        setDeleteId(undefined);
    };

    const handleSaveSettings = () => {
        const parsed = parseFloat(minHoursValue);
        if (Number.isNaN(parsed) || parsed <= 0) {
            setToast({ msg: 'Angiv et gyldigt antal timer', severity: 'error' });
            return;
        }
        updateSettings.mutate(
            { min_visit_hours: parsed },
            {
                onSuccess: () => setToast({ msg: 'Indstilling gemt', severity: 'success' }),
                onError: () => setToast({ msg: 'Kunne ikke gemme indstillingen', severity: 'error' }),
            }
        );
    };

    const columns: GridColDef[] = useMemo(
        () => [
            { field: 'name', headerName: 'Navn', flex: 1.5, minWidth: 160 },
            { field: 'address', headerName: 'Adresse', flex: 1.5, minWidth: 160 },
            { field: 'latitude', headerName: 'Breddegrad', flex: 1, minWidth: 110, type: 'number' },
            { field: 'longitude', headerName: 'Længdegrad', flex: 1, minWidth: 110, type: 'number' },
            {
                field: 'actions',
                headerName: '',
                sortable: false,
                filterable: false,
                width: 110,
                align: 'right',
                headerAlign: 'right',
                renderCell: (params: GridRenderCellParams) => {
                    const workshop = params.row as Workshop;
                    return (
                        <>
                            <Tooltip title="Redigér">
                                <span>
                                    <IconButton size="small" disabled={!hasWritePrivilege} onClick={() => openEdit(workshop)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Slet">
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={!hasWritePrivilege}
                                        onClick={() => setDeleteId(workshop.id ?? undefined)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </>
                    );
                },
            },
        ],
        [hasWritePrivilege]
    );

    return (
        <>
            <PageTitle
                title="Værksteder"
                subtitle="Registrér værksteder, så køretøjer der holder ved et værksted i længere tid vises som værkstedsbesøg i køretøjsaktivitet frem for som kørsel. Et besøg registreres, når et køretøj befinder sig ved et værksted længere end den angivne minimumstid."
            />

            <Card variant="outlined" sx={{ my: 2, maxWidth: 480 }}>
                <CardContent>
                    <PageTitle title="Minimum tid for registrering af besøg" level="section" />
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }} alignItems="flex-start">
                        <TextField
                            type="number"
                            size="small"
                            value={minHoursValue}
                            onChange={(e) => setMinHours(e.target.value)}
                            disabled={!hasWritePrivilege || !settings}
                            error={settingsError}
                            helperText={settingsError ? 'Indstillingen kunne ikke hentes' : undefined}
                            InputProps={{ endAdornment: <InputAdornment position="end">timer</InputAdornment> }}
                            sx={{ width: 160 }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleSaveSettings}
                            disabled={!hasWritePrivilege || updateSettings.isPending}
                        >
                            Gem globalt
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <div className="flex justify-end mt-4 mb-2">
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!hasWritePrivilege}>
                    Tilføj værksted
                </Button>
            </div>

            {isError ? (
                <ApiError retryFunction={() => refetch()}>Værkstederne kunne ikke hentes</ApiError>
            ) : isPending ? (
                <Skeleton variant="rounded" height={400} />
            ) : (
                <DataGrid
                    rows={workshops ?? []}
                    columns={columns}
                    getRowId={(row) => row.id ?? 0}
                    density="compact"
                    disableColumnResize
                    disableRowSelectionOnClick
                    initialState={{
                        pagination: { paginationModel: { pageSize: 20 } },
                        sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
                    }}
                    pageSizeOptions={[10, 20, 50]}
                    localeText={{
                        ...daDK.components.MuiDataGrid.defaultProps.localeText,
                        paginationRowsPerPage: 'Rækker per side:',
                        paginationDisplayedRows: ({ from, to, count }) => `${from}–${to} af ${count}`,
                        noRowsLabel: 'Ingen værksteder registreret',
                    }}
                    sx={{
                        '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
                        '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
                    }}
                />
            )}

            <WorkshopDialog
                open={dialogOpen}
                workshop={editing}
                saving={createWorkshop.isPending || updateWorkshop.isPending}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
            />

            <Dialog open={deleteId != null} onClose={() => setDeleteId(undefined)} maxWidth="xs" fullWidth>
                <DialogTitle>Slet værksted</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Er du sikker på, at du vil slette dette værksted? Registrerede besøg på værkstedet slettes også.
                        Handlingen kan ikke fortrydes.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button variant="text" color="inherit" onClick={() => setDeleteId(undefined)}>
                        Annuller
                    </Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>
                        Slet
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!toast}
                autoHideDuration={4000}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {toast ? (
                    <Alert severity={toast.severity} onClose={() => setToast(null)}>
                        {toast.msg}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </>
    );
}
