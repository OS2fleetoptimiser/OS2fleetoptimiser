import { Alert, Button, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { Form, Formik } from 'formik';
import SaveIcon from '@mui/icons-material/Save';
import { array, InferType, object, string } from 'yup';
import { Fragment, useState } from 'react';
import usePatchConfigurations from '@/components/hooks/usePatchConfigurations';
import usePatchAllShifts from '@/components/hooks/usePatchAllShifts';
import { useAppDispatch } from './redux/hooks';
import { setAllShiftSettings, setLocationSpecificShifts } from './redux/SimulationSlice';
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";


const timeStampRegex = /^(0?[0-9]|1[0-9]|2[0-3])[:\.][0-5][0-9]([:\.][0-5][0-9])?$/;

const shiftSchema = object({
    shifts: array()
        .of(
            object({
                shift_start: string().required('Feltet må ikke være tomt').matches(timeStampRegex, 'Indtast et tidspunkt'),
                shift_end: string().required('Feltet må ikke være tomt').matches(timeStampRegex, 'Indtast et tidspunkt'),
                shift_break: string()
                    .matches(timeStampRegex, 'Indtast et tidspunkt')
                    .test('Break in timeslot', 'Pausen skal ligge imellem start- og sluttidspunktet', (shift_break, context) => {
                        const timeslot = context.parent;
                        if (!shift_break) return true;
                        // We dont the formatting since it is browser language dependant
                        if (timeslot.shift_end === '00:00') {
                            timeslot.shift_end = '24:00';
                        } else if (timeslot.shift_end === '00:00:00') {
                            timeslot.shift_end = '24:00:00';
                        } else if (timeslot.shift_end === '00.00.00') {
                            timeslot.shift_end = '24.00.00';
                        } else if (timeslot.shift_end === '00.00') {
                            timeslot.shift_end = '24.00';
                        }
                        if (timeslot.shift_start === '24:00') {
                            timeslot.shift_start = '00:00';
                        } else if (timeslot.shift_start === '24:00:00') {
                            timeslot.shift_start = '00:00:00';
                        } else if (timeslot.shift_start === '24.00.00') {
                            timeslot.shift_start = '00.00.00';
                        } else if (timeslot.shift_start === '24.00') {
                            timeslot.shift_start = '00.00';
                        }
                        if (timeslot.shift_start < timeslot.shift_end) {
                            if (shift_break > timeslot.shift_start && shift_break < timeslot.shift_end) return true;
                        } else {
                            // If shift runs over midnight we need to swap symbols
                            if (shift_break < timeslot.shift_start && shift_break > timeslot.shift_end) return true;
                        }
                        return false;
                    })
                    .nullable(),
            })
        )
        .test('No overlapping times', 'Tidsperioderne må ikke overlappe', (timeSlots) => {
            if (timeSlots) {
                const formatErrors = timeSlots.filter(
                    (timeSlot) =>
                        !timeStampRegex.test(timeSlot.shift_start) ||
                        !timeStampRegex.test(timeSlot.shift_end) ||
                        (timeSlot.shift_break && !timeStampRegex.test(timeSlot.shift_break))
                );
                if (formatErrors.length > 0) {
                    // If there are formatting erros this test must pass to not overwrite the error texts from other errors
                    return true;
                }
                for (let i = 0; i < timeSlots.length; i++) {
                    for (let j = i + 1; j < timeSlots.length; j++) {
                        if (
                            //Might need to fix this as they need to start and stop at same time
                            (timeSlots[i].shift_start >= timeSlots[j].shift_start && timeSlots[i].shift_start < timeSlots[j].shift_end) ||
                            (timeSlots[j].shift_start >= timeSlots[i].shift_start && timeSlots[j].shift_start < timeSlots[i].shift_end)
                        ) {
                            return false;
                        }
                    }
                }
            }
            return true;
        })
        .test('Shifts must be consecutive', 'Vagtlagene skal følge lige efter hinanden', (timeSlots) => {
            if (timeSlots) {
                const formatErrors = timeSlots.filter(
                    (timeSlot) =>
                        !timeStampRegex.test(timeSlot.shift_start) ||
                        !timeStampRegex.test(timeSlot.shift_end) ||
                        (timeSlot.shift_break && !timeStampRegex.test(timeSlot.shift_break))
                );
                if (formatErrors.length > 0) {
                    return false;
                }
                for (let i = 0; i < timeSlots.length; i++) {
                    if (i === timeSlots.length - 1) {
                        if (timeSlots[i].shift_end !== timeSlots[0].shift_start) return false;
                    } else {
                        if (timeSlots[i].shift_end !== timeSlots[i + 1].shift_start) return false;
                    }
                }
            }
            return true;
        })
        .test('Must fill all hours of day', 'Vagtlagene skal dække alle 24 timer i døgnet', (timeSlots) => {
            if (timeSlots && timeSlots.length >= 2) {
                const formatErrors = timeSlots.filter(
                    (timeSlot) =>
                        !timeStampRegex.test(timeSlot.shift_start) ||
                        !timeStampRegex.test(timeSlot.shift_end) ||
                        (timeSlot.shift_break && !timeStampRegex.test(timeSlot.shift_break))
                );
                if (formatErrors.length > 0) {
                    return false;
                }
                if (timeSlots[0].shift_start !== timeSlots[timeSlots.length - 1].shift_end) return false;
            }
            return true;
        }),
});

type FormData = InferType<typeof shiftSchema>;

export const ShiftForm = ({ shifts, locationId, addressName, closeIt }: FormData & { locationId: number; addressName?: string; closeIt?: any }) => {
    // The way submitting is handled here is dumb but formik doesn't pass the original event to the submit function
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { mutate } = usePatchConfigurations();
    const { mutate: mutateAll } = usePatchAllShifts();

    const [submitAll, setSubmitAll] = useState<boolean>(false);
    const [submitType, setSubmitType] = useState<'local' | 'global'>('local');

    const dispatch = useAppDispatch();

    const renderAlert = (status?: string) => {
        if (!status) {
            return undefined;
        } else if (status === 'success') {
            return (
                <Alert className="mb-2" severity="success">
                    Ændringerne er blevet gemt
                </Alert>
            );
        } else {
            return (
                <Alert className="mb-2" severity="error">
                    Der opstod en fejl
                </Alert>
            );
        }
    };
    return (
        <div style={{ border: 'solid 0.5px lightgray', padding: '10px', margin: '5px' }}>
            {addressName && <p style={{ marginBottom: '10px' }}>Vagtlagsindstillinger for {addressName}</p>}
            <Formik
                onSubmit={(values, helpers) => {
                    if (submitType === 'global') {
                        if (submitAll) {
                            dispatch(setAllShiftSettings({ location_id: locationId, shifts: values.shifts ?? [] }));
                            mutateAll(values.shifts?.map((shift) => ({ ...shift, shift_break: shift.shift_break === '' ? null : shift.shift_break })) ?? [], {
                                onError: () => helpers.setStatus('ServerError'),
                                onSuccess: () => {
                                    helpers.setStatus('success');
                                    closeIt?.();
                                },
                            });
                        } else {
                            dispatch(setLocationSpecificShifts({ location_id: locationId, shifts: values.shifts ?? [] }));
                            mutate(
                                {
                                    shift_settings: [
                                        {
                                            location_id: locationId,
                                            //Backend doesnt accept undefined break value
                                            shifts:
                                                values.shifts?.map((shift) => ({
                                                    ...shift,
                                                    shift_break: shift.shift_break === '' ? null : shift.shift_break,
                                                })) ?? [],
                                        },
                                    ],
                                },
                                {
                                    onError: () => helpers.setStatus('ServerError'),
                                    onSuccess: () => {
                                        helpers.setStatus('success');
                                        closeIt?.();
                                    },
                                }
                            );
                        }
                    } else {
                        helpers.setStatus('success');
                        closeIt?.();
                        dispatch(setLocationSpecificShifts({ location_id: locationId, shifts: values.shifts ?? [] }));
                    }
                    helpers.setSubmitting(false);
                }}
                validationSchema={shiftSchema}
                initialValues={{ shifts: shifts }}
            >
                {({ values, touched, errors, handleChange, isSubmitting, setFieldValue, submitForm, status }) => {
                    return (
                        <>
                            {renderAlert(status)}
                            <Form>
                                <>
                                    <FormControl className="w-48 mr-2 my-6 subtle">
                                        <InputLabel>Vagtlag</InputLabel>
                                        <Select
                                            className="subtle"
                                            value={values.shifts?.length ?? 0}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        bgcolor: '#f5f5f5'
                                                    }
                                                }
                                            }}
                                            onChange={(e) => {
                                                setFieldValue(
                                                    'shifts',
                                                    Array.from({ length: +e.target.value }, () => ({
                                                        shift_start: '08:00',
                                                        shift_end: '10:00',
                                                    }))
                                                );
                                            }}
                                            label="Vagtlag"
                                        >
                                            <MenuItem value={0}>Ingen vagtlag</MenuItem>
                                            <MenuItem value={2}>2-holdskifte</MenuItem>
                                            <MenuItem value={3}>3-holdskifte</MenuItem>
                                            <MenuItem value={4}>4-holdskifte</MenuItem>
                                            <MenuItem value={5}>5-holdskifte</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <>
                                        {values.shifts &&
                                            values.shifts.map((shift, index) => (
                                                <Fragment key={index}>
                                                    <h3 className="mb-2 text-lg">Vagt {index + 1}</h3>
                                                    <div className="flex mb-2">
                                                        <TextField
                                                            name={`shifts.${index}.shift_start`}
                                                            id={`shifts.${index}.shift_start`}
                                                            label="Start"
                                                            onChange={handleChange}
                                                            value={shift.shift_start}
                                                            type="time"
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            error={touched.shifts?.[index]?.shift_start && Boolean(errors.shifts?.[index]?.shift_start)}
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            helperText={touched.shifts?.[index]?.shift_start && errors.shifts?.[index]?.shift_start}
                                                            className="w-30 subtle"
                                                            slotProps={{
                                                                inputLabel: {
                                                                    shrink: true,
                                                                }
                                                            }}
                                                        />
                                                        <TextField
                                                            className="mx-2 w-30 subtle"
                                                            name={`shifts.${index}.shift_end`}
                                                            id={`shifts.${index}.shift_end`}
                                                            label="Slut"
                                                            onChange={handleChange}
                                                            value={shift.shift_end}
                                                            type="time"
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            error={touched.shifts?.[index]?.shift_end && Boolean(errors.shifts?.[index]?.shift_end)}
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            helperText={touched.shifts?.[index]?.shift_end && errors.shifts?.[index]?.shift_end}
                                                            slotProps={{
                                                                inputLabel: {
                                                                    shrink: true,
                                                                }
                                                            }}
                                                        />
                                                        <TextField
                                                            name={`shifts.${index}.shift_break`}
                                                            id={`shifts.${index}.shift_break`}
                                                            label="Pause"
                                                            onChange={handleChange}
                                                            value={shift.shift_break ?? ''}
                                                            type="time"
                                                            required={false}
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            error={touched.shifts?.[index]?.shift_break && Boolean(errors.shifts?.[index]?.shift_break)}
                                                            // @ts-expect-error Formik nested array touched/errors type mismatch
                                                            helperText={touched.shifts?.[index]?.shift_break && errors.shifts?.[index]?.shift_break}
                                                            className="w-30 subtle mb-8"
                                                            slotProps={{
                                                                inputLabel: {
                                                                    shrink: true,
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </Fragment>
                                            ))}
                                    </>
                                    {touched.shifts && errors.shifts && typeof errors.shifts === 'string' && <p className="text-red-500">{errors.shifts}</p>}
                                </>
                                <div className="flex items-end flex-col">
                                    <Button
                                        onClick={() => {
                                            setSubmitType('global');
                                            setSubmitAll(true);
                                            submitForm();
                                        }}
                                        disabled={!hasWritePrivilege}
                                        endIcon={<SaveIcon />}
                                        loading={isSubmitting}
                                        loadingPosition="end"
                                        variant="contained"
                                        className="mb-2"
                                        name={'all'}
                                    >
                                        <span>Gem for alle lokationer</span>
                                    </Button>
                                    <Button
                                        disabled={!hasWritePrivilege}
                                        onClick={() => {
                                            setSubmitType('global');
                                            setSubmitAll(false);
                                            submitForm();
                                        }}
                                        endIcon={<SaveIcon />}
                                        loading={isSubmitting}
                                        loadingPosition="end"
                                        variant="contained"
                                    >
                                        <span>Gem for denne lokation</span>
                                    </Button>
                                </div>
                            </Form>
                        </>
                    );
                }}
            </Formik>
        </div>
    );
};
