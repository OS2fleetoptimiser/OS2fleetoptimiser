import { useMutation } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import { DropDownData } from './useGetDropDownData';
import usePatchConfigurations from './usePatchConfigurations';

export type shifts = {
    shift_start: string;
    shift_end: string;
    shift_break?: string | null;
}[];

function usePatchAllShifts() {
    const patchConfigurations = usePatchConfigurations();

    return useMutation({
        mutationFn: async (values: shifts) => {
            const locations = await AxiosBase.get<DropDownData>('configuration/dropdown-data').then((res) => res.data.locations.map((loc) => loc.id));
            const updates = locations.map((id) => ({ location_id: id, shifts: values }));
            patchConfigurations.mutate({ shift_settings: updates });
        }
    });
}

export default usePatchAllShifts;
