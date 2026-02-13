import { matchErrors } from '@/app/(logged-in)/configuration/ErrorFeedback';
import { validationSchema } from '@/app/(logged-in)/configuration/ValidationScheme';
import API from '@/components/AxiosBase';
import { DropDownData } from '@/components/hooks/useGetDropDownData';
import { Vehicle, VehicleWithOutID } from '@/components/hooks/useGetVehicles';
import { Alert, Button, Dialog, DialogContent, DialogTitle, MenuItem, Snackbar, TextField, DialogActions } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { FormikValues, useFormik } from 'formik';
import { useState } from 'react';
import Divider from '@mui/material/Divider';

interface VehicleModalProps {
    onClose: () => void;
    submit: (values: FormikValues) => void;
    open: boolean;
    dropDownData: DropDownData;
    initialValues?: Vehicle;
    isUpdate?: boolean;
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

export const VehicleModal = ({ open, onClose, submit, dropDownData, initialValues: initialValuesProp, isUpdate }: VehicleModalProps) => {
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
            <Dialog open={open}>
                <DialogTitle textAlign="center">{isUpdate ? 'Opdater Køretøj' : 'Tilføj Testkøretøj'}</DialogTitle>
                <DialogContent>
                    {(!isUpdate || initialValues.test_vehicle) && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-gray-700">
                                <strong>Testkøretøj:</strong> Et testkøretøj er ikke forbundet til dit flådestyringssystem og vil derfor ikke blive
                                synkroniseret automatisk. Brug denne funktion til at tilføje køretøjer til testformål og til at simulere scenarier i
                                FleetOptimiser.
                            </p>
                        </div>
                    )}
                    <form onSubmit={formik.handleSubmit}>
                        {isUpdate && !initialValues.test_vehicle && (
                            <div className="flex p-2">
                                <TextField
                                    className="w-1/2 subtle pr-4"
                                    label="Nummerplade"
                                    type="text"
                                    id="plate"
                                    name="plate"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.plate ?? ''}
                                />
                                {formik.touched.plate && formik.errors.plate ? <div>{formik.errors.plate}</div> : null}
                            </div>
                        )}
                        <div className="p-2 space-y-4">
                            <p className="font-bold text-sm">Stamdata</p>
                            <div className="flex space-x-8">
                                <TextField
                                    className="w-1/2 subtle"
                                    label="Mærke"
                                    type="text"
                                    id="make"
                                    name="make"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.make ?? ''}
                                />
                                {formik.touched.make && formik.errors.make ? <div>{formik.errors.make}</div> : null}
                                <TextField
                                    className="w-1/2 subtle"
                                    label="Model"
                                    type="text"
                                    id="model"
                                    name="model"
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    value={formik.values.model ?? ''}
                                />

                                {formik.touched.model && formik.errors.model ? <div>{formik.errors.model}</div> : null}
                            </div>
                            <div className="flex space-x-8">
                                <TextField
                                    className="w-1/2 subtle"
                                    id="type.id"
                                    name="type.id"
                                    label="Køretøjs Type"
                                    required={true}
                                    select
                                    value={formik.values.type?.id || ''}
                                    onChange={(event) => {
                                        formik.handleChange(event);
                                        setSelectedVehicleType(Number(event.target.value)); // Set selected vehicle to the value selected
                                    }}
                                    onBlur={formik.handleBlur}
                                >
                                    {dropDownData.vehicle_types.map((type) => (
                                        <MenuItem key={type.id} value={type.id}>
                                            {type.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                {formik.touched.type && formik.touched.type && formik.errors.type ? <div>{formik.errors.type}</div> : null}

                                <TextField
                                    className="w-1/2 subtle"
                                    id="fuel.id"
                                    name="fuel.id"
                                    label="Drivmiddel"
                                    required={true}
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
                                {selectedVehicleType === 4 ? (
                                    <TextField
                                        className="subtle"
                                        name="wltp_fossil"
                                        label="WLTP (km/l)"
                                        type="number"
                                        value={formik.values.wltp_fossil || ''}
                                        onChange={formik.handleChange}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: {
                                                    min: 0,
                                                    step: 0.1,
                                                },
                                            }
                                        }}
                                    />
                                ) : selectedVehicleType === 3 ? (
                                    <TextField
                                        name="wltp_el"
                                        label="WLTP (Wh/km)"
                                        className="subtle"
                                        type="number"
                                        value={formik.values.wltp_el || ''}
                                        required={true}
                                        onChange={formik.handleChange}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: {
                                                    min: 0,
                                                    step: 0.1,
                                                },
                                            }
                                        }}
                                    />
                                ) : null}
                            </div>
                            <TextField
                                className="w-1/2 subtle pr-4" // to align with make input
                                label="Omkostning / år"
                                type="number"
                                id="omkostning_aar"
                                name="omkostning_aar"
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                value={formik.values.omkostning_aar ?? ''}
                                slotProps={{
                                    input: {
                                        inputMode: 'decimal',
                                        inputProps: {
                                            min: 0,
                                            step: 0.1,
                                        },
                                    }
                                }}
                            />
                            {formik.touched.omkostning_aar && formik.errors.omkostning_aar ? <div>{formik.errors.omkostning_aar}</div> : null}
                            {(selectedVehicleType === 3 || (isUpdate && !initialValues.test_vehicle)) && <Divider className="my-4" />}
                        </div>

                        {selectedVehicleType === 3 && (
                            <div>
                                <div className="p-2 space-y-4">
                                    <p className="font-bold text-sm">Detaljer for elkøretøjer</p>
                                    <div className="flex space-x-8">
                                        <TextField
                                            className="w-1/3 subtle"
                                            label="WLTP Nedskrivning (%)"
                                            type="number"
                                            id="capacity_decrease"
                                            name="capacity_decrease"
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            value={formik.values.capacity_decrease ?? ''}
                                            slotProps={{
                                                input: {
                                                    inputMode: 'decimal',
                                                    inputProps: {
                                                        min: 0,
                                                        step: 0.1,
                                                    },
                                                }
                                            }}
                                        />
                                        {formik.touched.capacity_decrease && formik.errors.capacity_decrease ? (
                                            <div>{formik.errors.capacity_decrease}</div>
                                        ) : null}
                                        <TextField
                                            className="w-1/3 subtle"
                                            label="Rækkevidde"
                                            type="number"
                                            id="range"
                                            name="range"
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            value={formik.values.range ?? ''}
                                            slotProps={{
                                                input: {
                                                    inputMode: 'decimal',
                                                    inputProps: {
                                                        min: 0,
                                                        step: 0.1,
                                                    },
                                                }
                                            }}
                                        />
                                        {formik.touched.range && formik.errors.range ? <div>{formik.errors.range}</div> : null}
                                        <TextField
                                            className="w-1/3 subtle"
                                            label="Hvile / Opladningstid"
                                            type="number"
                                            id="sleep"
                                            name="sleep"
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            value={formik.values.sleep ?? ''}
                                            slotProps={{
                                                input: {
                                                    inputMode: 'decimal',
                                                    inputProps: {
                                                        min: 0,
                                                        step: 0.1,
                                                    },
                                                }
                                            }}
                                        />
                                        {formik.touched.sleep && formik.errors.sleep ? <div>{formik.errors.sleep}</div> : null}
                                    </div>
                                </div>
                                {isUpdate && !initialValues.test_vehicle && <Divider className="my-4" />}
                            </div>
                        )}

                        {isUpdate && !initialValues.test_vehicle && (
                            <div>
                                <div className="p-2 space-y-4">
                                    <p className="font-bold text-sm">Tilhørsforhold</p>
                                    <div className="flex space-x-8">
                                        <TextField
                                            className="w-1/2 subtle"
                                            label="Forvaltning"
                                            type="text"
                                            id="forvaltning"
                                            name="forvaltning"
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            value={formik.values.forvaltning ?? ''}
                                            onKeyDown={(e) => {
                                                if (e.key === ',') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                        {formik.touched.forvaltning && formik.errors.forvaltning ? <div>{formik.errors.forvaltning}</div> : null}

                                        <TextField
                                            className="w-1/2 subtle"
                                            label="Afdeling"
                                            type="text"
                                            id="department"
                                            name="department"
                                            onChange={formik.handleChange}
                                            onBlur={formik.handleBlur}
                                            value={formik.values.department ?? ''}
                                            onKeyDown={(e) => {
                                                if (e.key === ',') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                        {formik.touched.department && formik.errors.department ? <div>{formik.errors.department}</div> : null}
                                    </div>
                                    <div className="flex">
                                        <TextField
                                            className="w-full subtle"
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
                                        {formik.touched.location && formik.touched.location && formik.errors.location ? (
                                            <div>{formik.errors.location}</div>
                                        ) : null}
                                    </div>
                                </div>
                                <Divider className="my-4" />
                            </div>
                        )}

                        {isUpdate && !initialValues.test_vehicle && (
                            <div className="p-2 space-y-4">
                                <p className="font-bold text-sm">Leasinginformation</p>
                                <div className="flex space-x-8">
                                    <TextField
                                        className="w-1/2 subtle"
                                        id="leasing_type.id"
                                        name="leasing_type.id"
                                        label="Leasing Type"
                                        select
                                        value={formik.values.leasing_type?.id || ''}
                                        onChange={(event) => {
                                            formik.handleChange(event);
                                            setSelectedLeasingType(Number(event.target.value)); // Set selected vehicle to the value selected
                                        }}
                                        onBlur={formik.handleBlur}
                                    >
                                        {dropDownData.leasing_types.map((leasing) => (
                                            <MenuItem key={leasing.id} value={leasing.id}>
                                                {leasing.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    {formik.touched.leasing_type && formik.errors.leasing_type ? <div>{formik.errors.leasing_type}</div> : null}
                                    <TextField
                                        className="w-1/2 subtle"
                                        label="Km pr år"
                                        type="number"
                                        id="km_aar"
                                        name="km_aar"
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        value={formik.values.km_aar ?? ''}
                                        slotProps={{
                                            input: {
                                                inputMode: 'decimal',
                                                inputProps: {
                                                    min: 0,
                                                    step: 0.1,
                                                },
                                            }
                                        }}
                                    />
                                    {formik.touched.km_aar && formik.errors.km_aar ? <div>{formik.errors.km_aar}</div> : null}
                                </div>
                                <div className="flex space-x-8">
                                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="da">
                                        <DatePicker
                                            defaultValue={formik.initialValues.start_leasing ? dayjs(formik.initialValues.start_leasing) : null}
                                            format="DD-MM-YYYY"
                                            label="Start Leasing"
                                            onChange={(date) => formik.setFieldValue('start_leasing', date ? dayjs(date).format('YYYY-MM-DD') : '')}
                                            className={
                                                formik.touched.start_leasing && formik.errors.start_leasing && !formik.values.start_leasing
                                                    ? 'error subtle'
                                                    : ' subtle'
                                            }
                                        />
                                        {formik.touched.start_leasing && formik.errors.start_leasing ? <div>{formik.errors.start_leasing}</div> : null}
                                        <DatePicker
                                            defaultValue={formik.initialValues.end_leasing ? dayjs(formik.initialValues.end_leasing) : null}
                                            format="DD-MM-YYYY"
                                            label="Slut Leasing"
                                            onChange={(date) => formik.setFieldValue('end_leasing', date ? dayjs(date).format('YYYY-MM-DD') : '')}
                                            slotProps={{
                                                textField: {
                                                    required: selectedLeasingType === 1 || selectedLeasingType === 2,
                                                },
                                            }}
                                            className={
                                                formik.touched.end_leasing && formik.errors.end_leasing && !formik.values.end_leasing
                                                    ? 'error subtle'
                                                    : 'subtle'
                                            }
                                        />
                                        {formik.touched.end_leasing && formik.errors.end_leasing ? <div>{formik.errors.end_leasing}</div> : null}
                                    </LocalizationProvider>
                                </div>
                            </div>
                        )}
                        <DialogActions className="m-2 mt-4">
                            <Button
                                variant="outlined"
                                onClick={handleOnClose}
                            >
                                Annuller
                            </Button>
                            <Button variant="contained" type="submit">
                                {isUpdate ? 'Opdater' : 'Tilføj'}
                            </Button>
                        </DialogActions>
                    </form>
                </DialogContent>

                <Snackbar open={isSnackbarOpen} onClose={handleCloseSnackbar} autoHideDuration={snackbarDuration}>
                    <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} style={{ marginBottom: '8px' }}>
                        {snackbarMessages.map((message, index) => (
                            <div key={index}>{message}</div>
                        ))}
                    </Alert>
                </Snackbar>
            </Dialog>
        </>
    );
};

export default VehicleModal;
