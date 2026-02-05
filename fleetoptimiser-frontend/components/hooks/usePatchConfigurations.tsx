import { useMutation, useQueryClient } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import { settings } from './useGetSettings';

export type settingsUpdate = Partial<{ [P in keyof settings]: Partial<settings[P]> }>;

function usePatchConfigurations() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (values: settingsUpdate) => {
            return AxiosBase.patch('configuration/update-configurations', values);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['settings']
            });
        },
    });
}

export default usePatchConfigurations;
