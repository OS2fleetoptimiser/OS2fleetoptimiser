import { Alert, Box, Button, FormControl, MenuItem, Paper, Select, TextField, TextFieldProps, Typography } from '@mui/material';
import { Form, Formik, FormikErrors, FormikTouched } from 'formik';
import SaveIcon from '@mui/icons-material/Save';
import { array, InferType, object, string } from 'yup';
import { useState } from 'react';
import usePatchConfigurations from '@/components/hooks/usePatchConfigurations';
import usePatchAllShifts from '@/components/hooks/usePatchAllShifts';
import { useAppDispatch } from './redux/hooks';
import { setAllShiftSettings, setLocationSpecificShifts } from './redux/SimulationSlice';
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";


const timeStampRegex = /^(0?[0-9]|1[0-9]|2[0-3])[:\.][0-5][0-9]([:\.][0-5][0-9])?$/;

const midnightMappings: Record<string, string> = {
    '00:00': '24:00',
    '00:00:00': '24:00:00',
    '00.00': '24.00',
    '00.00.00': '24.00.00',
    '24:00': '00:00',
    '24:00:00': '00:00:00',
    '24.00': '00.00',
    '24.00.00': '00.00.00',
};

const normalizeMidnight = (time: string) => midnightMappings[time] ?? time;

type ShiftSlot = { shift_start: string; shift_end: string; shift_break?: string | null };

const hasFormatErrors = (timeSlots: ShiftSlot[]) =>
    timeSlots.some(
        (s) =>
            !timeStampRegex.test(s.shift_start) ||
            !timeStampRegex.test(s.shift_end) ||
            (s.shift_break && !timeStampRegex.test(s.shift_break))
    );

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

                        // Normalize midnight boundaries (browser locale can use : or . separators)
                        timeslot.shift_end = normalizeMidnight(timeslot.shift_end);
                        timeslot.shift_start = normalizeMidnight(timeslot.shift_start);

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
            if (!timeSlots) return true;
            // If there are formatting errors this test must pass to not overwrite the error texts from other errors
            if (hasFormatErrors(timeSlots)) return true;

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
            return true;
        })
        .test('Shifts must be consecutive', 'Vagtlagene skal følge lige efter hinanden', (timeSlots) => {
            if (!timeSlots) return true;
            if (hasFormatErrors(timeSlots)) return false;

            for (let i = 0; i < timeSlots.length; i++) {
                if (i === timeSlots.length - 1) {
                    if (timeSlots[i].shift_end !== timeSlots[0].shift_start) return false;
                } else {
                    if (timeSlots[i].shift_end !== timeSlots[i + 1].shift_start) return false;
                }
            }
            return true;
        })
        .test('Must fill all hours of day', 'Vagtlagene skal dække alle 24 timer i døgnet', (timeSlots) => {
            if (!timeSlots || timeSlots.length < 2) return true;
            if (hasFormatErrors(timeSlots)) return false;

            if (timeSlots[0].shift_start !== timeSlots[timeSlots.length - 1].shift_end) return false;
            return true;
        }),
});

type FormData = InferType<typeof shiftSchema>;

const ShiftTimeField = ({ index, field, label, value, touched, errors, required = true, ...rest }: {
    index: number;
    field: 'shift_start' | 'shift_end' | 'shift_break';
    label: string;
    value: string;
    touched?: FormikTouched<FormData>['shifts'];
    errors?: FormikErrors<FormData>['shifts'];
    required?: boolean;
} & Pick<TextFieldProps, 'onChange'>) => {
    // @ts-expect-error Formik nested array touched/errors type mismatch
    const fieldTouched = touched?.[index]?.[field];
    // @ts-expect-error Formik nested array touched/errors type mismatch
    const fieldError = errors?.[index]?.[field];

    return (
        <TextField
            name={`shifts.${index}.${field}`}
            id={`shifts.${index}.${field}`}
            label={label}
            value={value}
            type="time"
            size="small"
            sx={{ width: 130 }}
            required={required}
            error={fieldTouched && Boolean(fieldError)}
            helperText={fieldTouched && fieldError}
            slotProps={{ inputLabel: { shrink: true } }}
            {...rest}
        />
    );
};

export const ShiftForm = ({ shifts, locationId, addressName, closeIt }: FormData & { locationId: number; addressName?: string; closeIt?: () => void }) => {
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
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="subtitle2" color="text.primary">
                                    {addressName || `Lokation ${locationId}`}
                                </Typography>
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <Select
                                        value={values.shifts?.length ?? 0}
                                        onChange={(e) => {
                                            setFieldValue(
                                                'shifts',
                                                Array.from({ length: +e.target.value }, () => ({
                                                    shift_start: '08:00',
                                                    shift_end: '10:00',
                                                }))
                                            );
                                        }}
                                    >
                                        <MenuItem value={0}>Ingen vagtlag</MenuItem>
                                        <MenuItem value={2}>2-holdskifte</MenuItem>
                                        <MenuItem value={3}>3-holdskifte</MenuItem>
                                        <MenuItem value={4}>4-holdskifte</MenuItem>
                                        <MenuItem value={5}>5-holdskifte</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                            {renderAlert(status)}
                            <Form>
                                {values.shifts && values.shifts.length > 0 && (
                                    <Box sx={{ p: 2.5 }}>
                                        <div className="space-y-3">
                                            {values.shifts.map((shift, index) => (
                                                <div key={index} className="flex items-center gap-3">
                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48, fontWeight: 600 }}>
                                                        Vagt {index + 1}
                                                    </Typography>
                                                    <ShiftTimeField
                                                        index={index} field="shift_start" label="Start"
                                                        value={shift.shift_start} onChange={handleChange}
                                                        touched={touched.shifts} errors={errors.shifts}
                                                    />
                                                    <ShiftTimeField
                                                        index={index} field="shift_end" label="Slut"
                                                        value={shift.shift_end} onChange={handleChange}
                                                        touched={touched.shifts} errors={errors.shifts}
                                                    />
                                                    <ShiftTimeField
                                                        index={index} field="shift_break" label="Pause"
                                                        value={shift.shift_break ?? ''} onChange={handleChange}
                                                        touched={touched.shifts} errors={errors.shifts}
                                                        required={false}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        {touched.shifts && errors.shifts && typeof errors.shifts === 'string' && (
                                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                                {errors.shifts}
                                            </Typography>
                                        )}
                                        <div className="flex gap-2 justify-end mt-4">
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
                                                variant="outlined"
                                                size="small"
                                            >
                                                Gem for alle lokationer
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
                                                size="small"
                                            >
                                                Gem for denne lokation
                                            </Button>
                                        </div>
                                    </Box>
                                )}
                            </Form>
                        </>
                    );
                }}
            </Formik>
        </Paper>
    );
};
