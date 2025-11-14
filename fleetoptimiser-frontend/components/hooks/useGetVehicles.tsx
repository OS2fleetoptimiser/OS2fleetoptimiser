import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';

export type VehicleWithOutID = {
    name: string;
    plate: string | null;
    make: string | null;
    model: string | null;
    type: {
        id: number;
        name: string;
    } | null;
    fuel: {
        id: number;
        name: string;
    } | null;
    wltp_fossil: number | null;
    wltp_el: number | null;
    capacity_decrease: number | null;
    range: number | null;
    omkostning_aar: number | null;
    location: {
        id: number;
        address: string;
    } | null;
    start_leasing: string | null;
    end_leasing: string | null;
    leasing_type: {
        id: number;
        name: string;
    } | null;
    km_aar: number | null;
    deleted: boolean | null;
    sleep: number | null;
    department: string | null;
    disabled: boolean | null;
    imei: string | null;
    description: string | null;
    forvaltning: string | null;
    test_vehicle: boolean | null;
};

export type Vehicle = { id: number } & VehicleWithOutID;

type VehicleResult = {
    vehicles: Vehicle[];
};

function useGetVehicles<T = VehicleResult>(select?: (a: VehicleResult) => T) {
    return useQuery(['vehicles'], () => AxiosBase.get<VehicleResult>('configuration/vehicles').then((res) => res.data), {
        select: select,
        refetchOnWindowFocus: false,
    });
}

export default useGetVehicles;
