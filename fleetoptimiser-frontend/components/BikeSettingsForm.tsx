import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { FieldArray, Form, Formik } from 'formik';
import { useState } from 'react';
import { InferType, number, object, array, string } from 'yup';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import usePatchConfigurations from '@/components/hooks/usePatchConfigurations';
import { useAppDispatch } from './redux/hooks';
import { setBikeSettings } from './redux/SimulationSlice';
import { useWritePrivilegeContext } from "@/app/providers/WritePrivilegeProvider";

const timeStampRegex = /^(0?[0-9]|1[0-9]|2[0-3])[:\.][0-5][0-9]([:\.][0-5][0-9])?$/;

const bikeSchema = object({
    bikeSpeed: number().typeError('Cykel-hastighed skal være et tal').positive('Cykel-hastighed skal være mere end nul').required('Feltet må ikke være tomt'),
    electricalBikeSpeed: number()
        .typeError('Elcykel-hastighed skal være et tal')
        .positive('Elcykel-hastighed skal være mere end nul')
        .required('Feltet må ikke være tomt'),
    maxTripDistance: number()
        .typeError('Maks turlængde skal være et tal')
        .positive('Maks turlængde skal være mere end nul')
        .required('Feltet må ikke være tomt'),
    percentTaken: number()
        .typeError('Procent af ture skal være et tal')
        .min(0, 'Procent af ture skal være mellem 0 og 100')
        .max(100, 'Procent af ture skal være mellem 0 og 100')
        .required('Feltet må ikke være tomt'),
    bikeIntervals: array()
        .of(
            object({
                start: string().required('Feltet må ikke være tomt').matches(timeStampRegex, 'Indtast et tidspunkt'),
                end: string().required('Feltet må ikke være tomt').matches(timeStampRegex, 'Indtast et tidspunkt'),
            })
        )
        .test('No overlapping times test', 'Tidsperioderne må ikke overlappe', (timeSlots) => {
            if (timeSlots) {
                // We dont need to check timeslot overlaps if the are format errors in the fields
                const formatErrors = timeSlots.filter((timeSlot) => !timeStampRegex.test(timeSlot.start) || !timeStampRegex.test(timeSlot.end));
                if (formatErrors.length > 0) {
                    return false;
                }
                if (timeSlots.length > 1) {
                    for (let i = 0; i < timeSlots.length; i++) {
                        for (let j = i + 1; j < timeSlots.length; j++) {
                            if (
                                (timeSlots[i].start >= timeSlots[j].start && timeSlots[i].start < timeSlots[j].end) ||
                                (timeSlots[j].start >= timeSlots[i].start && timeSlots[j].start < timeSlots[i].end)
                            ) {
                                return false;
                            }
                        }
                    }
                }
            }
            return true;
        }),
});

type FormData = InferType<typeof bikeSchema>;

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
    <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="text.primary">{title}</Typography>
        {description && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 0.25 }}>
                {description}
            </Typography>
        )}
    </Box>
);

const BikeForm = (props: FormData) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { mutate } = usePatchConfigurations();
    const [submitType, setSubmitType] = useState<'local' | 'global'>('local');
    const dispatch = useAppDispatch();

    const { bikeSpeed, electricalBikeSpeed, maxTripDistance, percentTaken, bikeIntervals } = props;

    return (
        <div>
            <Formik
                onSubmit={(values, helpers) => {
                    if (submitType === 'global') {
                        mutate(
                            {
                                bike_settings: {
                                    max_km_pr_trip: +values.maxTripDistance,
                                    percentage_of_trips: +values.percentTaken,
                                    bike_slots: values.bikeIntervals?.map((slot) => ({ bike_start: slot.start, bike_end: slot.end })) ?? [],
                                    electrical_bike_speed: +values.electricalBikeSpeed,
                                    bike_speed: +values.bikeSpeed,
                                },
                            },
                            {
                                onError: () => helpers.setStatus('ServerError'),
                                onSuccess: () => {
                                    dispatch(setBikeSettings({
                                        max_km_pr_trip: +values.maxTripDistance,
                                        percentage_of_trips: +values.percentTaken,
                                        bike_slots: values.bikeIntervals?.map((slot) => ({ bike_start: slot.start, bike_end: slot.end })) ?? [],
                                        electrical_bike_speed: +values.electricalBikeSpeed,
                                        bike_speed: +values.bikeSpeed,
                                    }));
                                    helpers.setSubmitting(false);
                                    helpers.setStatus('success');
                                },
                            }
                        );
                    } else {
                        dispatch(
                            setBikeSettings({
                                max_km_pr_trip: +values.maxTripDistance,
                                percentage_of_trips: +values.percentTaken,
                                bike_slots: values.bikeIntervals?.map((slot) => ({ bike_start: slot.start, bike_end: slot.end })) ?? [],
                                electrical_bike_speed: +values.electricalBikeSpeed,
                                bike_speed: +values.bikeSpeed,
                            })
                        );
                        helpers.setSubmitting(false);
                        helpers.setStatus('success');
                    }
                }}
                validationSchema={bikeSchema}
                initialValues={{
                    bikeSpeed: bikeSpeed,
                    electricalBikeSpeed: electricalBikeSpeed,
                    maxTripDistance: maxTripDistance,
                    percentTaken: percentTaken,
                    bikeIntervals: bikeIntervals,
                }}
            >
                {({ values, touched, errors, handleChange, isSubmitting, status, handleSubmit }) => {
                    return (
                        <>
                            {status === 'success' && (
                                <Alert className="mb-3" severity="success">Ændringerne er blevet gemt</Alert>
                            )}
                            {status === 'ServerError' && (
                                <Alert className="mb-3" severity="error">Der opstod en fejl</Alert>
                            )}
                            <Form>
                                <div className="space-y-4">
                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Turindstillinger"
                                            description="Maksimal turlængde og andel af kvalificerede rundture der allokeres til cykel."
                                        />
                                        <div className="grid grid-cols-2 gap-3 p-4">
                                            <TextField
                                                id="maxTripDistance"
                                                name="maxTripDistance"
                                                label="Maks. km pr. tur"
                                                size="small"
                                                onChange={handleChange}
                                                value={values.maxTripDistance}
                                                error={touched.maxTripDistance && Boolean(errors.maxTripDistance)}
                                                helperText={touched.maxTripDistance && errors.maxTripDistance}
                                            />
                                            <TextField
                                                id="percentTaken"
                                                name="percentTaken"
                                                label="Procent af ture som køres (%)"
                                                size="small"
                                                value={values.percentTaken}
                                                onChange={handleChange}
                                                error={touched.percentTaken && Boolean(errors.percentTaken)}
                                                helperText={touched.percentTaken && errors.percentTaken}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Hastighed"
                                            description="Effektiv køretid i km/t ekskl. parkering. Det anbefales at sætte hastigheden højere end forventet for at maksimere antallet af realistiske cykelruter."
                                        />
                                        <div className="grid grid-cols-2 gap-3 p-4">
                                            <TextField
                                                id="bikeSpeed"
                                                name="bikeSpeed"
                                                label="Almindelig cykel (km/t)"
                                                size="small"
                                                value={values.bikeSpeed}
                                                onChange={handleChange}
                                                error={touched.bikeSpeed && Boolean(errors.bikeSpeed)}
                                                helperText={touched.bikeSpeed && errors.bikeSpeed}
                                            />
                                            <TextField
                                                id="electricalBikeSpeed"
                                                name="electricalBikeSpeed"
                                                label="Elcykel (km/t)"
                                                size="small"
                                                value={values.electricalBikeSpeed}
                                                onChange={handleChange}
                                                error={touched.electricalBikeSpeed && Boolean(errors.electricalBikeSpeed)}
                                                helperText={touched.electricalBikeSpeed && errors.electricalBikeSpeed}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Tidsrum for cykeltildeling"
                                            description="Angiv hvornår rundture kan tildeles cykler. Der kan tilføjes flere tidsrum."
                                        />
                                        <FieldArray name="bikeIntervals">
                                            {({ remove, push }) => (
                                                <div className="p-4 space-y-3">
                                                    {values.bikeIntervals &&
                                                        values.bikeIntervals.map((interval, index) => (
                                                            <div className="flex items-center gap-3" key={index}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ width: 64, fontWeight: 600 }}>
                                                                    Interval {index + 1}
                                                                </Typography>
                                                                <TextField
                                                                    name={`bikeIntervals.${index}.start`}
                                                                    id={`bikeIntervals.${index}.start`}
                                                                    label="Start"
                                                                    onChange={handleChange}
                                                                    value={interval.start}
                                                                    type="time"
                                                                    size="small"
                                                                    sx={{ width: 130 }}
                                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                                    // @ts-expect-error Formik nested array touched/errors type mismatch
                                                                    error={touched.bikeIntervals?.[index]?.start && Boolean(errors.bikeIntervals?.[index]?.start)}
                                                                    // @ts-expect-error Formik nested array touched/errors type mismatch
                                                                    helperText={touched.bikeIntervals?.[index]?.start && errors.bikeIntervals?.[index]?.start}
                                                                />
                                                                <TextField
                                                                    name={`bikeIntervals.${index}.end`}
                                                                    id={`bikeIntervals.${index}.end`}
                                                                    label="Slut"
                                                                    onChange={handleChange}
                                                                    value={interval.end}
                                                                    type="time"
                                                                    size="small"
                                                                    sx={{ width: 130 }}
                                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                                    // @ts-expect-error Formik nested array touched/errors type mismatch
                                                                    error={touched.bikeIntervals?.[index]?.end && Boolean(errors.bikeIntervals?.[index]?.end)}
                                                                    // @ts-expect-error Formik nested array touched/errors type mismatch
                                                                    helperText={touched.bikeIntervals?.[index]?.end && errors.bikeIntervals?.[index]?.end}
                                                                />
                                                                <Button onClick={() => remove(index)} color="error" variant="outlined" size="small" startIcon={<DeleteOutlineIcon />}>
                                                                    Slet
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    {touched.bikeIntervals && errors.bikeIntervals && typeof errors.bikeIntervals === 'string' && (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                                                            {errors.bikeIntervals}
                                                        </Typography>
                                                    )}
                                                    <Button type="button" size="small" variant="outlined" onClick={() => push({ start: '08:00', end: '10:00' })} startIcon={<AddIcon />}>
                                                        Tilføj tidsinterval
                                                    </Button>
                                                </div>
                                            )}
                                        </FieldArray>
                                    </Paper>

                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            disabled={!hasWritePrivilege}
                                            type="button"
                                            onClick={() => {
                                                setSubmitType('local');
                                                handleSubmit();
                                            }}
                                            endIcon={<SaveIcon />}
                                            loading={isSubmitting}
                                            loadingPosition="end"
                                            variant="outlined"
                                            size="small"
                                        >
                                            Gem for nuværende simulering
                                        </Button>
                                        <Button
                                            disabled={!hasWritePrivilege}
                                            type="button"
                                            onClick={() => {
                                                setSubmitType('global');
                                                handleSubmit();
                                            }}
                                            endIcon={<SaveIcon />}
                                            loading={isSubmitting}
                                            loadingPosition="end"
                                            variant="contained"
                                            size="small"
                                        >
                                            Gem globalt
                                        </Button>
                                    </div>
                                </div>
                            </Form>
                        </>
                    );
                }}
            </Formik>
        </div>
    );
};

export default BikeForm;
