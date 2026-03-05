import usePatchConfigurations from '@/components/hooks/usePatchConfigurations';
import ToolTip from '@/components/ToolTip';
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
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

export const SettingsForm = ({ initialValues }: { initialValues: FormData }) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const { mutate } = usePatchConfigurations();
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
                            {renderAlert(status)}
                            <Form>
                                <div className="mb-4">
                                    <h2 className="text-lg">
                                        Udledning
                                            <ToolTip>
                                                CO2e afhængige variabler i simuleringen. Juster værdierne her, hvis du vil ændre hvor mange kilo CO2e der bliver
                                                udledt af hhv. 1 kWh, 1 liter benzin og 1 liter diesel. CO2e er en ækvivalent der bruges så fossil- og elkøretøjer
                                                kan sammenlignes.
                                            </ToolTip>
                                        <p className="text-sm font-normal mb-2">CO2e afhængige variabler</p>
                                    </h2>
                                    <TextField
                                        onChange={handleChange}
                                        value={values.el_udledning}
                                        className="mr-2 my-2 w-1/6 subtle"
                                        id="el_udledning"
                                        label="El (kg. CO2e/kWh)"
                                        error={touched.el_udledning && Boolean(errors.el_udledning)}
                                        helperText={touched.el_udledning && errors.el_udledning}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.benzin_udledning}
                                        className="m-2 w-1/6 subtle"
                                        label="Benzin (kg. CO2e/liter)"
                                        id="benzin_udledning"
                                        error={touched.benzin_udledning && Boolean(errors.benzin_udledning)}
                                        helperText={touched.benzin_udledning && errors.benzin_udledning}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.diesel_udledning}
                                        className="m-2 w-1/6 subtle"
                                        label="Diesel (kg. CO2e/liter)"
                                        id="diesel_udledning"
                                        error={touched.diesel_udledning && Boolean(errors.diesel_udledning)}
                                        helperText={touched.diesel_udledning && errors.diesel_udledning}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.hvo_udledning}
                                        className="m-2 w-1/6 subtle"
                                        label="HVO (kg. CO2e/liter)"
                                        id="hvo_udledning"
                                        error={touched.hvo_udledning && Boolean(errors.hvo_udledning)}
                                        helperText={touched.hvo_udledning && errors.hvo_udledning}
                                    />
                                </div>
                                <div className="mb-4">
                                    <h2 className="text-lg mb-2">
                                        Drivmiddel priser{' '}
                                        <ToolTip>
                                            Juster værdierne herunder, for at ændre priserne på de forskellige drivmidler. Hvert køretøj skal bruge en mængde
                                            drivmiddel til at køre det, i simuleringen antal allokeret kilometer.
                                        </ToolTip>
                                    </h2>
                                    <TextField
                                        onChange={handleChange}
                                        value={values.pris_el}
                                        className="mr-2 my-2 w-1/6 subtle"
                                        label="El (kr./kWh)"
                                        id="pris_el"
                                        error={touched.pris_el && Boolean(errors.pris_el)}
                                        helperText={touched.pris_el && errors.pris_el}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.pris_benzin}
                                        className="m-2 w-1/6 subtle"
                                        label="Benzin (kr./liter)"
                                        id="pris_benzin"
                                        error={touched.pris_benzin && Boolean(errors.pris_benzin)}
                                        helperText={touched.pris_benzin && errors.pris_benzin}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.pris_diesel}
                                        className="m-2 w-1/6 subtle"
                                        label="Diesel (kr./liter)"
                                        id="pris_diesel"
                                        error={touched.pris_diesel && Boolean(errors.pris_diesel)}
                                        helperText={touched.pris_diesel && errors.pris_diesel}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.pris_hvo}
                                        className="m-2 w-1/6 subtle"
                                        label="HVO (kr./liter)"
                                        id="pris_hvo"
                                        error={touched.pris_hvo && Boolean(errors.pris_hvo)}
                                        helperText={touched.pris_hvo && errors.pris_hvo}
                                    />
                                </div>
                                <div className="mb-4">
                                    <h2 className="text-lg mb-2">
                                        Samfundsøkonomiske omkostninger
                                        <ToolTip>
                                            Hvad er de eksterne samfundsøkonomiske påvirkninger - hvad koster det samfundet at udlede et ton CO2e. Dette beløb
                                            bliver pålagt den samlede omkostning.
                                        </ToolTip>
                                    </h2>
                                    <TextField
                                        onChange={handleChange}
                                        className="w-1/6 subtle"
                                        value={values.vaerdisaetning_tons_co2}
                                        label="Kr. pr. ton CO2e udledning"
                                        id="vaerdisaetning_tons_co2"
                                        error={touched.vaerdisaetning_tons_co2 && Boolean(errors.vaerdisaetning_tons_co2)}
                                        helperText={touched.vaerdisaetning_tons_co2 && errors.vaerdisaetning_tons_co2}
                                    ></TextField>
                                </div>
                                <div className="mb-4">
                                    <h2 className="text-lg mb-2">
                                        Køretøjsskift
                                        <ToolTip>
                                            Hvor lang tid tager det at skifte køretøj. Denne tid er det, der minimum skal gå mellem et køretøj har fundet hjem
                                            og er &quot;fri&quot; til, at det kan acceptere en ny tur.
                                        </ToolTip>
                                    </h2>
                                    <TextField
                                        onChange={handleChange}
                                        value={values.sub_time}
                                        className="w-1/6 subtle"
                                        label="Minimum skiftetid (minutter)"
                                        id="sub_time"
                                        error={touched.sub_time && Boolean(errors.sub_time)}
                                        helperText={touched.sub_time && errors.sub_time}
                                    />
                                </div>
                                <div className="mb-4">
                                    <h2 className="text-lg mb-1">Medarbejderbil</h2>
                                    <h3 className="text-base mb-2">
                                        Kørepenge
                                        <ToolTip>
                                            Rundture der ikke allokeres i simuleringen, bliver &quot;kørt&quot; af en medarbejderbil, hvorved kørepenge
                                            udbetales og dermed er det ikke omkostningsfrit at have uallokerede rundture. Grænsen afgører, hvor mange km. der
                                            betales af hhv. den høje - og lave takst.
                                        </ToolTip>
                                    </h3>
                                    <TextField
                                        onChange={handleChange}
                                        value={values.high}
                                        className="mr-2 my-2 w-1/6 subtle"
                                        label="Lav takst (kr./km)"
                                        id="high"
                                        error={touched.high && Boolean(errors.high)}
                                        helperText={touched.high && errors.high}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.low}
                                        className="m-2 w-1/6 subtle"
                                        label="Høj takst (kr./km)"
                                        id="low"
                                        error={touched.low && Boolean(errors.low)}
                                        helperText={touched.low && errors.low}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.distance_threshold}
                                        className="m-2 w-1/6 subtle"
                                        label="Takst-grænse (km.)"
                                        id="distance_threshold"
                                        error={touched.distance_threshold && Boolean(errors.distance_threshold)}
                                        helperText={touched.distance_threshold && errors.distance_threshold}
                                    />
                                    <h3 className="text-base mb-2">
                                        Medarbejder køretøj
                                        <ToolTip>
                                            Rundture der ikke allokeres i simuleringen, bliver &quot;kørt&quot; af en medarbejderbil, hvorved CO2e udledningen
                                            også medregnes, så det ikke er omkostningsfrit at have uallokerede rundture. Vælg hvilket køretøjstype og dets CO2e
                                            udledning.
                                        </ToolTip>
                                    </h3>
                                    <FormControl className="w-40 mr-2 my-2 subtle">
                                        <InputLabel>Køretøjstype</InputLabel>
                                        <Select
                                            className="subtle"
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        bgcolor: '#f5f5f5'
                                                    }
                                                }
                                            }}
                                            value={values.undriven_type}
                                            onChange={(e) => {
                                                setFieldValue('undriven_type', e.target.value);
                                            }}
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
                                        label="WLTP (km/l)"
                                        id="undriven_wltp"
                                        error={touched.undriven_wltp && Boolean(errors.undriven_wltp)}
                                        helperText={touched.undriven_wltp && errors.undriven_wltp}
                                        className="m-2 subtle w-1/6"
                                    />
                                </div>
                                <div>
                                    <h2 className="text-lg">Ukørte ture
                                        <ToolTip>
                                            Vælg om det skal være tilladt for den automatiske simulering at have ukørte ture i den endelige løsning.
                                            Det kan hjælpe algoritmen til at finde frem til mere optimerede løsninger, når der er enkelte ture der gerne må udelades.
                                            Du kan indtaste det antal ture du maksimalt tillader at være ukørt, samt længden af disse. Længere ukørte ture vil blive vægtet dårligere,
                                            så simuleringen vil forsøge at efterlade kortere ture som ukørt.
                                        </ToolTip>
                                    </h2>
                                    <p className="text-xs text-explanation mb-2">Gælder kun i automatisk simulering</p>
                                    <TextField
                                        onChange={handleChange}
                                        value={values.slack}
                                        className="mr-2 my-2 w-1/6 subtle"
                                        label="Antal tilladte ukørte ture"
                                        id="slack"
                                        error={touched.high && Boolean(errors.high)}
                                        helperText={touched.high && errors.high}
                                    />
                                    <TextField
                                        onChange={handleChange}
                                        value={values.max_undriven}
                                        className="m-2 w-1/6 subtle"
                                        label="Maksimal længde på ukørte ture (km)"
                                        id="max_driven"
                                        error={touched.low && Boolean(errors.low)}
                                        helperText={touched.low && errors.low}
                                    />
                                </div>
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
                                        <span>Gem for nuværende simulation</span>
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
                            </Form>
                        </>
                    );
                }}
            </Formik>
        </div>
    );
};

export default SettingsForm;
