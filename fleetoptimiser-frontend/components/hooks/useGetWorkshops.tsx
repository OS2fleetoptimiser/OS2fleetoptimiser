import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AxiosBase from '@/components/AxiosBase';

export interface Workshop {
    id: number | null;
    name: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    addition_date: string | null;
}

export interface WorkshopVisit {
    id: number;
    car_id: number;
    workshop_id: number;
    workshop_name: string | null;
    workshop_address: string | null;
    plate: string | null;
    start_time: string | null;
    end_time: string | null;
    duration: number | null;
}

export interface WorkshopSettings {
    min_visit_hours: number;
}

export const useGetWorkshops = () =>
    useQuery({
        queryKey: ['workshops'],
        queryFn: () => AxiosBase.get<Workshop[]>('workshops/workshop').then((res) => res.data),
        refetchOnWindowFocus: false,
    });

export const useGetWorkshopSettings = () =>
    useQuery({
        queryKey: ['workshop settings'],
        queryFn: () => AxiosBase.get<WorkshopSettings>('workshops/settings').then((res) => res.data),
        refetchOnWindowFocus: false,
    });

export const useCreateWorkshop = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (workshop: Workshop) => AxiosBase.post<Workshop>('workshops/workshop', workshop).then((res) => res.data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    });
};

export const useUpdateWorkshop = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (workshop: Workshop) => AxiosBase.patch<Workshop>('workshops/workshop', workshop).then((res) => res.data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    });
};

export const useDeleteWorkshop = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (workshopId: number) => AxiosBase.delete(`workshops/workshop/${workshopId}`).then((res) => res.data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    });
};

export const useUpdateWorkshopSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: WorkshopSettings) =>
            AxiosBase.patch<WorkshopSettings>('workshops/settings', settings).then((res) => res.data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshop settings'] }),
    });
};
