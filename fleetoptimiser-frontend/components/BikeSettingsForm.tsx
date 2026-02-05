import ToolTip from '@/components/ToolTip';
import { Alert, Button, Divider, TextField } from '@mui/material';
import { FieldArray, Form, Formik } from 'formik';
import { useState } from 'react';
import { InferType, number, object, array, string } from 'yup';
import SaveIcon from '@mui/icons-material/Save';
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

const BikeForm = (props: FormData) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { mutate } = usePatchConfigurations();
    const [submitType, setSubmitType] = useState<'local' | 'global'>('local');
    const dispatch = useAppDispatch();

    const { bikeSpeed, electricalBikeSpeed, maxTripDistance, percentTaken, bikeIntervals } = props;

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
                                    dispatch(setBikeSettings);
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
                        <Form>
                            <TextField
                                className="subtle w-1/4"
                                id="maxTripDistance"
                                name="maxTripDistance"
                                label="Maks. km. pr. tur"
                                onChange={handleChange}
                                value={values.maxTripDistance}
                                error={touched.maxTripDistance && Boolean(errors.maxTripDistance)}
                                helperText={
                                    (touched.maxTripDistance && errors.maxTripDistance) || 'Maksimal længde på individuelle ture, der kan køres på cykel.'
                                }
                            />
                            <TextField
                                className="subtle w-1/4 mx-4"
                                id="percentTaken"
                                name="percentTaken"
                                label="Procent af disse ture som køres"
                                value={values.percentTaken}
                                onChange={handleChange}
                                error={touched.percentTaken && Boolean(errors.percentTaken)}
                                helperText={
                                    (touched.percentTaken && errors.percentTaken) ||
                                    'Hvor mange procent af ture, der kvalificerer sig til at blive allokeret til cykel, skal accepteres.'
                                }
                            />
                            <Divider className="my-8" />
                            <TextField
                                className="subtle w-1/4"
                                id="bikeSpeed"
                                name="bikeSpeed"
                                label="Almindelig cykel, maks. gnms. hastighed"
                                value={values.bikeSpeed}
                                onChange={handleChange}
                                error={touched.bikeSpeed && Boolean(errors.bikeSpeed)}
                                helperText={touched.bikeSpeed && errors.bikeSpeed}
                            />
                            <TextField
                                className="subtle w-1/4 mx-4"
                                id="electricalBikeSpeed"
                                name="electricalBikeSpeed"
                                label="Elcykel, maks. gnms. hastighed"
                                value={values.electricalBikeSpeed}
                                onChange={handleChange}
                                error={touched.electricalBikeSpeed && Boolean(errors.electricalBikeSpeed)}
                                helperText={touched.electricalBikeSpeed && errors.electricalBikeSpeed}
                            />
                            <p>
                                <span className="text-explanation leading-explanation text-xs w-1/2 block ml-4 mt-2">
                                    Hvor hurtigt (km/t) kan der køres på cykler - effektiv køretid ekskl. pause/parkering.<br></br>
                                    Vær opmærksom på, at parkeringstiden er ekskluderet. Det anbefales at sætte hastigheden højere end den forventede hastighed,
                                    for at maksimere antallet af realistiske cykelruter.
                                </span>
                            </p>
                            <Divider className="my-6" />
                            <h3 className="mb-4">
                                Tidsrum hvor cykler kan tildeles
                                <ToolTip>
                                    Det tidsrum hvor ture på cykel kan accepteres. Der kan f.eks. være politik om, at cykler kun må bruges mellem 8:00 og 15:00.
                                    Det er muligt at tilføje flere end et tidsrum.
                                </ToolTip>
                            </h3>
                            <FieldArray name="bikeIntervals">
                                {({ insert, remove, push }) => (
                                    <div className="mb-4">
                                        {values.bikeIntervals &&
                                            values.bikeIntervals.map((interval, index) => (
                                                <div className="flex mb-4" key={index}>
                                                    <TextField
                                                        className="mr-2"
                                                        name={`bikeIntervals.${index}.start`}
                                                        id={`bikeIntervals.${index}.start`}
                                                        label="Start"
                                                        onChange={handleChange}
                                                        value={interval.start}
                                                        type="time"
                                                        //@ts-ignore
                                                        error={touched.bikeIntervals?.[index].start && Boolean(errors.bikeIntervals?.[index].start)}
                                                        //@ts-ignore
                                                        helperText={touched.bikeIntervals?.[index].start && errors.bikeIntervals?.[index].start}
                                                    />
                                                    <TextField
                                                        className="mr-2"
                                                        name={`bikeIntervals.${index}.end`}
                                                        id={`bikeIntervals.${index}.end`}
                                                        label="Slut"
                                                        onChange={handleChange}
                                                        value={interval.end}
                                                        type="time"
                                                        //@ts-ignore
                                                        error={touched.bikeIntervals?.[index].end && Boolean(errors.bikeIntervals?.[index].end)}
                                                        //@ts-ignore
                                                        helperText={touched.bikeIntervals?.[index].end && errors.bikeIntervals?.[index].end}
                                                    />

                                                    <Button
                                                        onClick={() => {
                                                            remove(index);
                                                        }}
                                                        color="error"
                                                    >
                                                        Slet
                                                    </Button>
                                                </div>
                                            ))}
                                        {touched.bikeIntervals && errors.bikeIntervals && (
                                            <p className="text-red-500">Tidsintervallerne for cykelkørsel må ikke overlappe</p>
                                        )}
                                        <Button type="button" onClick={() => push({ start: '08:00', end: '10:00' })}>
                                            Tilføj tidsinterval
                                        </Button>
                                    </div>
                                )}
                            </FieldArray>
                            <div className="flex items-end flex-col">
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
                                    variant="contained"
                                    className="mb-2"
                                >
                                    <span>Gem for nuværende simulering</span>
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
                                >
                                    <span>Gem globalt</span>
                                </Button>
                            </div>
                            {status === 'ServerError' && <p>Der opstod en fejl på serveren der forhindrede ændringerne i at blive gemt</p>}
                        </Form>
                    );
                }}
            </Formik>
        </div>
    );
};

export default BikeForm;
