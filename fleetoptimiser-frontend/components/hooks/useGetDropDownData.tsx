import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';

export type FuelType = {
    id: number;
    name: string;
};

export type LeasingType = {
    id: number;
    name: string;
};

export type VehicleType = {
    id: number;
    name: string;
};

export type Location = {
    id: number;
    address: string;
};

export type DropDownData = {
    fuel_types: FuelType[];
    leasing_types: LeasingType[];
    vehicle_types: VehicleType[];
    locations: Location[];
    departments: string[];
};

function useGetDropDownData<T = DropDownData>(selector?: (data: DropDownData) => T) {
    return useQuery({
        queryKey: ['dropDownData'],
        queryFn: () => AxiosBase.get<DropDownData>('configuration/dropdown-data').then((res) => res.data),
        select: selector
    });
}

export default useGetDropDownData;
