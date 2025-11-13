import * as Yup from 'yup';

export const validationSchema = Yup.object().shape({
    plate: Yup.string().notRequired(),
    make: Yup.string().notRequired(),
    model: Yup.string().notRequired(),
    capacity_decrease: Yup.number().nullable().notRequired(),
    range: Yup.number().nullable().notRequired(),
    omkostning_aar: Yup.number().nullable().notRequired(),
    department: Yup.string().notRequired(),
    km_aar: Yup.number().nullable().notRequired(),
    sleep: Yup.number().nullable().notRequired(),
});
