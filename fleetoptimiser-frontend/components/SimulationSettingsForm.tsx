import usePatchConfigurations from '@/components/hooks/usePatchConfigurations';
import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField, Typography } from '@mui/material';
import { Form, Formik } from 'formik';
import { InferType, number, object, string } from 'yup';
import SaveIcon from '@mui/icons-material/Save';
import { useState } from 'react';
import { useAppDispatch } from './redux/hooks';
import { setSimulationSettings } from './redux/SimulationSlice';
import { useWritePrivilegeContext } from "@/app/providers/WritePrivilegeProvider";

const simulationSettingsSchema = object({
    el_udledning: number().required('Dette felt skal være udfyldt'),
    benzin_udledning: number().required('Dette felt skal være udfyldt'),
    diesel_udledning: number().required('Dette felt skal være udfyldt'),
    hvo_udledning: number().required('Dette felt skal være udfyldt'),
    pris_el: number().required('Dette felt skal være udfyldt'),
    pris_benzin: number().required('Dette felt skal være udfyldt'),
    pris_diesel: number().required('Dette felt skal være udfyldt'),
    pris_hvo: number().required('Dette felt skal være udfyldt'),
    vaerdisaetning_tons_co2: number().required('Dette felt skal være udfyldt'),
    sub_time: number().required('Dette felt skal være udfyldt'),
    high: number().required('Dette felt skal være udfyldt'),
    low: number().required('Dette felt skal være udfyldt'),
    distance_threshold: number().required('Dette felt skal være udfyldt'),
    undriven_type: string().required('Dette felt skal være udfyldt'),
    undriven_wltp: number().required('Dette felt skal være udfyldt'),
    slack: number().required('Dette felt skal være udfyldt'),
    max_undriven: number().required('Dette felt skal være udfyldt')
});

type FormData = InferType<typeof simulationSettingsSchema>;

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

export const SettingsForm = ({ initialValues }: { initialValues: FormData }) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { mutate } = usePatchConfigurations();
    const [submitType, setSubmitType] = useState<'local' | 'global'>('local');
    const dispatch = useAppDispatch();

    return (
        <div>
            <Formik
                onSubmit={(values, helpers) => {
                    if (submitType === 'global') {
                        mutate(
                            {
                                simulation_settings: values,
                            },
                            {
                                onError: () => helpers.setStatus('ServerError'),
                                onSuccess: () => {
                                    dispatch(setSimulationSettings(values));
                                    helpers.setSubmitting(false);
                                    helpers.setStatus('success');
                                },
                            }
                        );
                    } else {
                        dispatch(setSimulationSettings(values));
                        helpers.setSubmitting(false);
                        helpers.setStatus('success');
                    }
                }}
                validationSchema={simulationSettingsSchema}
                initialValues={initialValues}
            >
                {({ values, touched, errors, handleChange, isSubmitting, status, setFieldValue, handleSubmit }) => {
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
                                            title="Udledning"
                                            description="Angiv kg. CO2e pr. kWh, liter benzin, diesel og HVO. CO2e er en fælles enhed, som gør det muligt at sammenligne udledning på tværs af drivmidler."
                                        />
                                        <div className="grid grid-cols-2 gap-3 p-4">
                                            <TextField
                                                onChange={handleChange}
                                                value={values.el_udledning}
                                                id="el_udledning"
                                                label="El (kg. CO2e/kWh)"
                                                size="small"
                                                error={touched.el_udledning && Boolean(errors.el_udledning)}
                                                helperText={touched.el_udledning && errors.el_udledning}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.benzin_udledning}
                                                id="benzin_udledning"
                                                label="Benzin (kg. CO2e/liter)"
                                                size="small"
                                                error={touched.benzin_udledning && Boolean(errors.benzin_udledning)}
                                                helperText={touched.benzin_udledning && errors.benzin_udledning}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.diesel_udledning}
                                                id="diesel_udledning"
                                                label="Diesel (kg. CO2e/liter)"
                                                size="small"
                                                error={touched.diesel_udledning && Boolean(errors.diesel_udledning)}
                                                helperText={touched.diesel_udledning && errors.diesel_udledning}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.hvo_udledning}
                                                id="hvo_udledning"
                                                label="HVO (kg. CO2e/liter)"
                                                size="small"
                                                error={touched.hvo_udledning && Boolean(errors.hvo_udledning)}
                                                helperText={touched.hvo_udledning && errors.hvo_udledning}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Drivmiddelpriser"
                                            description="Pris pr. enhed for hvert drivmiddel. Bruges til at beregne driftsomkostninger ud fra allokerede kilometer."
                                        />
                                        <div className="grid grid-cols-2 gap-3 p-4">
                                            <TextField
                                                onChange={handleChange}
                                                value={values.pris_el}
                                                id="pris_el"
                                                label="El (kr./kWh)"
                                                size="small"
                                                error={touched.pris_el && Boolean(errors.pris_el)}
                                                helperText={touched.pris_el && errors.pris_el}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.pris_benzin}
                                                id="pris_benzin"
                                                label="Benzin (kr./liter)"
                                                size="small"
                                                error={touched.pris_benzin && Boolean(errors.pris_benzin)}
                                                helperText={touched.pris_benzin && errors.pris_benzin}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.pris_diesel}
                                                id="pris_diesel"
                                                label="Diesel (kr./liter)"
                                                size="small"
                                                error={touched.pris_diesel && Boolean(errors.pris_diesel)}
                                                helperText={touched.pris_diesel && errors.pris_diesel}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.pris_hvo}
                                                id="pris_hvo"
                                                label="HVO (kr./liter)"
                                                size="small"
                                                error={touched.pris_hvo && Boolean(errors.pris_hvo)}
                                                helperText={touched.pris_hvo && errors.pris_hvo}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Samfundsøkonomiske omkostninger"
                                            description="Ekstern samfundsøkonomisk omkostning ved CO2e-udledning. Beløbet pålægges den samlede omkostning."
                                        />
                                        <div className="p-4">
                                            <TextField
                                                onChange={handleChange}
                                                value={values.vaerdisaetning_tons_co2}
                                                id="vaerdisaetning_tons_co2"
                                                label="Kr. pr. ton CO2e udledning"
                                                size="small"
                                                sx={{ width: 220 }}
                                                error={touched.vaerdisaetning_tons_co2 && Boolean(errors.vaerdisaetning_tons_co2)}
                                                helperText={touched.vaerdisaetning_tons_co2 && errors.vaerdisaetning_tons_co2}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Køretøjsskift"
                                            description="Minimum tid mellem et køretøj er hjemme og kan tage en ny tur."
                                        />
                                        <div className="p-4">
                                            <TextField
                                                onChange={handleChange}
                                                value={values.sub_time}
                                                id="sub_time"
                                                label="Minimum skiftetid (minutter)"
                                                size="small"
                                                sx={{ width: 220 }}
                                                error={touched.sub_time && Boolean(errors.sub_time)}
                                                helperText={touched.sub_time && errors.sub_time}
                                            />
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Medarbejderbil"
                                            description="Rundture der ikke allokeres i simuleringen køres af en medarbejderbil, hvor kørepenge udbetales og CO2e-udledningen medregnes."
                                        />
                                        <div className="p-4 space-y-4">
                                            <div>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1.5 }}>
                                                    Kørepenge
                                                </Typography>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <TextField
                                                        onChange={handleChange}
                                                        value={values.high}
                                                        id="high"
                                                        label="Lav takst (kr./km)"
                                                        size="small"
                                                        error={touched.high && Boolean(errors.high)}
                                                        helperText={touched.high && errors.high}
                                                    />
                                                    <TextField
                                                        onChange={handleChange}
                                                        value={values.low}
                                                        id="low"
                                                        label="Høj takst (kr./km)"
                                                        size="small"
                                                        error={touched.low && Boolean(errors.low)}
                                                        helperText={touched.low && errors.low}
                                                    />
                                                    <TextField
                                                        onChange={handleChange}
                                                        value={values.distance_threshold}
                                                        id="distance_threshold"
                                                        label="Takst-grænse (km.)"
                                                        size="small"
                                                        error={touched.distance_threshold && Boolean(errors.distance_threshold)}
                                                        helperText={touched.distance_threshold && errors.distance_threshold}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1.5 }}>
                                                    Medarbejder køretøj
                                                </Typography>
                                                <div className="flex gap-3">
                                                    <FormControl size="small" sx={{ minWidth: 160 }}>
                                                        <InputLabel>Køretøjstype</InputLabel>
                                                        <Select
                                                            value={values.undriven_type}
                                                            onChange={(e) => setFieldValue('undriven_type', e.target.value)}
                                                            label="Køretøjstype"
                                                        >
                                                            <MenuItem value={'benzin'}>Benzin</MenuItem>
                                                            <MenuItem value={'diesel'}>Diesel</MenuItem>
                                                            <MenuItem value={'el'}>El</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                    <TextField
                                                        onChange={handleChange}
                                                        value={values.undriven_wltp}
                                                        id="undriven_wltp"
                                                        label="WLTP (km/l)"
                                                        size="small"
                                                        sx={{ width: 140 }}
                                                        error={touched.undriven_wltp && Boolean(errors.undriven_wltp)}
                                                        helperText={touched.undriven_wltp && errors.undriven_wltp}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <SectionHeader
                                            title="Ukørte ture"
                                            description="Angiv hvor mange rundture der må udelades i den automatiske simulering for bedre optimering. Simuleringen vil forsøge at efterlade de korteste rundture som ukørte."
                                        />
                                        <div className="flex flex-wrap gap-3 p-4">
                                            <TextField
                                                onChange={handleChange}
                                                value={values.slack}
                                                id="slack"
                                                label="Antal tilladte ukørte ture"
                                                size="small"
                                                sx={{ flex: '1 1 180px' }}
                                                error={touched.slack && Boolean(errors.slack)}
                                                helperText={touched.slack && errors.slack}
                                            />
                                            <TextField
                                                onChange={handleChange}
                                                value={values.max_undriven}
                                                id="max_undriven"
                                                label="Maksimal længde på ukørte ture (km)"
                                                size="small"
                                                sx={{ flex: '1 1 180px' }}
                                                error={touched.max_undriven && Boolean(errors.max_undriven)}
                                                helperText={touched.max_undriven && errors.max_undriven}
                                            />
                                        </div>
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

export default SettingsForm;
