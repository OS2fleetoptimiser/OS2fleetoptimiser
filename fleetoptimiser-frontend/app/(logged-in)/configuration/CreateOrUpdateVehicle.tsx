import { matchErrors } from '@/app/(logged-in)/configuration/ErrorFeedback';
import { validationSchema } from '@/app/(logged-in)/configuration/ValidationScheme';
import API from '@/components/AxiosBase';
import { DropDownData } from '@/components/hooks/useGetDropDownData';
import { Vehicle, VehicleWithOutID } from '@/components/hooks/useGetVehicles';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Snackbar, TextField, Typography } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { FormikValues, useFormik } from 'formik';
import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';

interface VehicleFormContentProps {
    onClose: () => void;
    submit: (values: FormikValues) => void;
    dropDownData: DropDownData;
    initialValues?: Vehicle;
    isUpdate?: boolean;
}

interface VehicleModalProps extends VehicleFormContentProps {
    open: boolean;
}

export const emptyVehicle: VehicleWithOutID = {
    plate: '',
    make: '',
    model: '',
    name: '',
    type: { id: 0, name: '' },
    fuel: { id: 0, name: '' },
    wltp_fossil: null,
    wltp_el: null,
    capacity_decrease: null,
    range: null,
    omkostning_aar: null,
    location: { id: 0, address: '' },
    start_leasing: null,
    end_leasing: null,
    leasing_type: { id: 0, name: '' },
    km_aar: null,
    deleted: null,
    sleep: null,
    department: '',
    disabled: false,
    imei: null,
    description: null,
    forvaltning: null,
    test_vehicle: null,
};

const SectionHeader = ({ title }: { title: string }) => (
    <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="text.primary">{title}</Typography>
    </Box>
);

export const VehicleFormContent = ({ onClose, submit, dropDownData, initialValues: initialValuesProp, isUpdate }: VehicleFormContentProps) => {
    const [selectedVehicleType, setSelectedVehicleType] = useState(initialValuesProp?.type?.id);
    const [selectedLeasingType, setSelectedLeasingType] = useState(initialValuesProp?.leasing_type?.id);

    const [initialValues, setInitialValues] = useState<Vehicle | VehicleWithOutID>(initialValuesProp || emptyVehicle);
    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
    const [snackbarMessages, setSnackbarMessages] = useState<string[]>([]);
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
    const [snackbarDuration, setSnackbarDuration] = useState<number>(5000);

    const queryClient = useQueryClient();

    function handleOpenSnackbar(messages: string[], severity: 'success' | 'error' = 'success', duration: number = 5000) {
        setSnackbarMessages(messages);
        setSnackbarSeverity(severity);
        setSnackbarDuration(duration);
        setIsSnackbarOpen(true);
    }

    function handleCloseSnackbar() {
        setIsSnackbarOpen(false);
        setSnackbarMessages([]);
    }

    const handleOnClose = () => {
        setInitialValues(emptyVehicle);
        onClose();
    };

    const onSubmit = async (values: FormikValues) => {
        if (selectedVehicleType === 4) {
            values.wltp_el = null;
        } else if (selectedVehicleType === 3) {
            values.wltp_fossil = null;
        } else {
            values.wltp_fossil = null;
            values.wltp_el = null;
        }

        values.location.id = values.location.id === 0 ? null : values.location.id;
        values.leasing_type.id = values.leasing_type.id === 0 ? null : values.leasing_type.id;

        if (isUpdate) {
            try {
                //This is not great
                const response = await API.patch('configuration/vehicle', values);
                if (response.status === 200) {
                    await queryClient.invalidateQueries({
                        queryKey: ['vehicles']
                    });
                    submit(values);
                    onClose();
                }
            } catch (error: unknown) {
                if (isAxiosError(error) && error.response?.status === 422) {
                    const errorMessages = matchErrors(error.response.data.detail);
                    handleOpenSnackbar(errorMessages, 'error', 20000);
                }
            }
        } else {
            try {
                const response = await API.post<{ id: string }>('configuration/vehicle', values);

                if (response.status === 200) {
                    await queryClient.invalidateQueries({
                        queryKey: ['vehicles']
                    });
                    values.id = parseInt(response.data.id);
                    submit(values);
                    onClose();
                }
            } catch (error: unknown) {
                if (isAxiosError(error) && error.response?.status === 422) {
                    const errorMessages = matchErrors(error.response.data.detail);
                    handleOpenSnackbar(errorMessages, 'error', 20000);
                }
            }
        }
    };

    const formik = useFormik({
        initialValues,
        validationSchema,
        onSubmit,
    });

    return (
        <>
            {(!isUpdate || initialValues.test_vehicle) && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    Et testkøretøj er ikke forbundet til dit flådestyringssystem og vil derfor ikke blive synkroniseret automatisk. Brug denne funktion til at tilføje køretøjer til testformål og til at simulere scenarier i FleetOptimiser.
                </Alert>
            )}
            <form onSubmit={formik.handleSubmit}>
                <div className="space-y-4">
                    {isUpdate && !initialValues.test_vehicle && (
                        <TextField
                            fullWidth
                            size="small"
                            label="Nummerplade"
                            type="text"
                            id="plate"
                            name="plate"
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            value={formik.values.plate ?? ''}
                            error={formik.touched.plate && Boolean(formik.errors.plate)}
                            helperText={formik.touched.plate && formik.errors.plate}
                        />
                    )}

                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        <SectionHeader title="Stamdata" />
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    size="small"
                                    label="Mærke"
                                    type="text"
                                    id="make"
                                    name="make"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.make ?? ''}
                                    error={formik.touched.make && Boolean(formik.errors.make)}
                                    helperText={formik.touched.make && formik.errors.make}
                                />
                                <TextField
                                    size="small"
                                    label="Model"
                                    type="text"
                                    id="model"
                                    name="model"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.model ?? ''}
                                    error={formik.touched.model && Boolean(formik.errors.model)}
                                    helperText={formik.touched.model && formik.errors.model}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    size="small"
                                    id="type.id"
                                    name="type.id"
                                    label="Køretøjstype"
                                    required
                                    select
                                    value={formik.values.type?.id || ''}
                                    onChange={(event) => {
                                        formik.handleChange(event);
                                        setSelectedVehicleType(Number(event.target.value));
                                    }}
                                    onBlur={formik.handleBlur}
                                >
                                    {dropDownData.vehicle_types.map((type) => (
                                        <MenuItem key={type.id} value={type.id}>
                                            {type.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    size="small"
                                    id="fuel.id"
                                    name="fuel.id"
                                    label="Drivmiddel"
                                    required
                                    select
                                    value={formik.values.fuel?.id || ''}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                >
                                    {dropDownData.fuel_types.map((fuel) => (
                                        <MenuItem key={fuel.id} value={fuel.id}>
                                            {fuel.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    size="small"
                                    label="Omkostning / år"
                                    type="number"
                                    id="omkostning_aar"
                                    name="omkostning_aar"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.omkostning_aar ?? ''}
                                    error={formik.touched.omkostning_aar && Boolean(formik.errors.omkostning_aar)}
                                    helperText={formik.touched.omkostning_aar && formik.errors.omkostning_aar}
                                    slotProps={{
                                        input: {
                                            inputMode: 'decimal',
                                            inputProps: { min: 0, step: 0.1 },
                                        }
                                    }}
                                />
                                {selectedVehicleType === 4 && (
                                    <TextField
                                        size="small"
                                        name="wltp_fossil"
                                        label="WLTP (km/l)"
                                        type="number"
                                        value={formik.values.wltp_fossil || ''}
                                        onChange={formik.handleChange}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: { min: 0, step: 0.1 },
                                            }
                                        }}
                                    />
                                )}
                                {selectedVehicleType === 3 && (
                                    <TextField
                                        size="small"
                                        name="wltp_el"
                                        label="WLTP (Wh/km)"
                                        type="number"
                                        value={formik.values.wltp_el || ''}
                                        required
                                        onChange={formik.handleChange}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: { min: 0, step: 0.1 },
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </Paper>

                    {selectedVehicleType === 3 && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <SectionHeader title="Detaljer for elkøretøjer" />
                            <div className="grid grid-cols-3 gap-3 p-4">
                                <TextField
                                    size="small"
                                    label="WLTP Nedskrivning (%)"
                                    type="number"
                                    id="capacity_decrease"
                                    name="capacity_decrease"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.capacity_decrease ?? ''}
                                    error={formik.touched.capacity_decrease && Boolean(formik.errors.capacity_decrease)}
                                    helperText={formik.touched.capacity_decrease && formik.errors.capacity_decrease}
                                    slotProps={{
                                        input: {
                                            inputMode: 'decimal',
                                            inputProps: { min: 0, step: 0.1 },
                                        }
                                    }}
                                />
                                <TextField
                                    size="small"
                                    label="Rækkevidde"
                                    type="number"
                                    id="range"
                                    name="range"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.range ?? ''}
                                    error={formik.touched.range && Boolean(formik.errors.range)}
                                    helperText={formik.touched.range && formik.errors.range}
                                    slotProps={{
                                        input: {
                                            inputMode: 'decimal',
                                            inputProps: { min: 0, step: 0.1 },
                                        }
                                    }}
                                />
                                <TextField
                                    size="small"
                                    label="Hvile / Opladningstid"
                                    type="number"
                                    id="sleep"
                                    name="sleep"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.sleep ?? ''}
                                    error={formik.touched.sleep && Boolean(formik.errors.sleep)}
                                    helperText={formik.touched.sleep && formik.errors.sleep}
                                    slotProps={{
                                        input: {
                                            inputMode: 'decimal',
                                            inputProps: { min: 0, step: 0.1 },
                                        }
                                    }}
                                />
                            </div>
                        </Paper>
                    )}

                    {isUpdate && !initialValues.test_vehicle && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <SectionHeader title="Tilhørsforhold" />
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <TextField
                                        size="small"
                                        label="Forvaltning"
                                        type="text"
                                        id="forvaltning"
                                        name="forvaltning"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.forvaltning ?? ''}
                                        error={formik.touched.forvaltning && Boolean(formik.errors.forvaltning)}
                                        helperText={formik.touched.forvaltning && formik.errors.forvaltning}
                                        onKeyDown={(e) => { if (e.key === ',') e.preventDefault(); }}
                                    />
                                    <TextField
                                        size="small"
                                        label="Afdeling"
                                        type="text"
                                        id="department"
                                        name="department"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.department ?? ''}
                                        error={formik.touched.department && Boolean(formik.errors.department)}
                                        helperText={formik.touched.department && formik.errors.department}
                                        onKeyDown={(e) => { if (e.key === ',') e.preventDefault(); }}
                                    />
                                </div>
                                <TextField
                                    fullWidth
                                    size="small"
                                    id="location.id"
                                    name="location.id"
                                    label="Lokation"
                                    select
                                    value={formik.values.location?.id || ''}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
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
                        </Paper>
                    )}

                    {isUpdate && !initialValues.test_vehicle && (
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <SectionHeader title="Leasinginformation" />
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <TextField
                                        size="small"
                                        id="leasing_type.id"
                                        name="leasing_type.id"
                                        label="Leasing Type"
                                        select
                                        value={formik.values.leasing_type?.id || ''}
                                        onChange={(event) => {
                                            formik.handleChange(event);
                                            setSelectedLeasingType(Number(event.target.value));
                                        }}
                                        onBlur={formik.handleBlur}
                                    >
                                        {dropDownData.leasing_types.map((leasing) => (
                                            <MenuItem key={leasing.id} value={leasing.id}>
                                                {leasing.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        size="small"
                                        label="Km pr. år"
                                        type="number"
                                        id="km_aar"
                                        name="km_aar"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.km_aar ?? ''}
                                        error={formik.touched.km_aar && Boolean(formik.errors.km_aar)}
                                        helperText={formik.touched.km_aar && formik.errors.km_aar}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: { min: 0, step: 0.1 },
                                            }
                                        }}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="da">
                                        <DatePicker
                                            defaultValue={formik.initialValues.start_leasing ? dayjs(formik.initialValues.start_leasing) : null}
                                            format="DD-MM-YYYY"
                                            label="Start Leasing"
                                            onChange={(date) => formik.setFieldValue('start_leasing', date ? dayjs(date).format('YYYY-MM-DD') : null)}
                                            slotProps={{ textField: { size: 'small' } }}
                                        />
                                        <DatePicker
                                            defaultValue={formik.initialValues.end_leasing ? dayjs(formik.initialValues.end_leasing) : null}
                                            format="DD-MM-YYYY"
                                            label="Slut Leasing"
                                            onChange={(date) => formik.setFieldValue('end_leasing', date ? dayjs(date).format('YYYY-MM-DD') : null)}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    required: selectedLeasingType === 1 || selectedLeasingType === 2,
                                                },
                                            }}
                                        />
                                    </LocalizationProvider>
                                </div>
                            </div>
                        </Paper>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button variant="outlined" size="small" onClick={handleOnClose}>
                            Annuller
                        </Button>
                        <Button variant="contained" size="small" type="submit">
                            {isUpdate ? 'Opdater' : 'Tilføj'}
                        </Button>
                    </div>
                </div>
            </form>
            <Snackbar open={isSnackbarOpen} onClose={handleCloseSnackbar} autoHideDuration={snackbarDuration}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} style={{ marginBottom: '8px' }}>
                    {snackbarMessages.map((message, index) => (
                        <div key={index}>{message}</div>
                    ))}
                </Alert>
            </Snackbar>
        </>
    );
};

export const VehicleModal = ({ open, onClose, submit, dropDownData, initialValues, isUpdate }: VehicleModalProps) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fcfcfc' }}>
                <Typography variant="h6" component="span">
                    {isUpdate ? 'Opdater køretøj' : 'Opret nyt testkøretøj'}
                </Typography>
                <IconButton onClick={onClose} size="small" aria-label="luk">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 3 }}>
                <VehicleFormContent
                    onClose={onClose}
                    submit={submit}
                    dropDownData={dropDownData}
                    initialValues={initialValues}
                    isUpdate={isUpdate}
                />
            </DialogContent>
        </Dialog>
    );
};

export default VehicleModal;
