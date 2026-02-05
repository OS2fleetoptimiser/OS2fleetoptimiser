import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import AxiosBase from '../AxiosBase';
import { Vehicle } from './useGetVehicles';

export type VehicleWithStatus = Vehicle & {
    status: string;
};

export type locations = {
    locations: location[];
};

export type location = {
    id: number;
    address: string;
    vehicles: VehicleWithStatus[];
};

export type onlyLocation = {
    id: number;
    address: string;
};

export type onlyLocations = {
    locations: onlyLocation[];
};

export type Forvaltninger = {
    [key: string]: number[];
};

export type vehicleLocationFilters<T> = {
    startPeriod: Dayjs;
    endPeriod: Dayjs;
    location?: number;
    locations?: number[];
    forvaltning?: string;
    isReset?: boolean;
    selector?: (data: locations) => T;
    callback?: (data: locations) => void;
    savedLocs?: object;
    enabled?: boolean;
};

export async function fetchVehiclesByLocation<T>(options: vehicleLocationFilters<T>) {
    const isFetchEnabled = !(options.location === undefined) && !(options.location === 0);
    if (!isFetchEnabled) {
        return;
    }

    let locationQueryParam = '';
    if (options.location) {
        locationQueryParam = 'locations=' + options.location;
    }
    if (options.locations && options.locations.length > 0 && options.savedLocs && Object.keys(options.savedLocs).length === 0) {
        locationQueryParam = options.locations.map((id) => 'locations=' + id).join('&');
    }
    let forvaltningQueryParam = '';
    if (options.forvaltning) {
        forvaltningQueryParam = `&forvaltning=${encodeURIComponent(options.forvaltning)}`
    }
    try {
        const prefix = AxiosBase.defaults.baseURL
        const response = await fetch(
            `${prefix}simulation-setup/locations-vehicles?start_date=${options.startPeriod.format('YYYY-MM-DD')}&end_date=${options.endPeriod
                .add(1, 'day')
                .format('YYYY-MM-DD')}${locationQueryParam ? `&${locationQueryParam}` : ''}${forvaltningQueryParam}`
        ).then((res) => res.json());
        const data = response;
        if (options.callback) {
            options.callback(data);
        }

        if (options.selector) {
            return options.selector(data);
        }

        return data;
    } catch (error) {
        console.error('Error fetching vehicles by location:', error);
        throw error;
    }
}

function useGetVehiclesByLocation<T = locations>(options: vehicleLocationFilters<T>) {
    return useQuery({
        queryKey: ['locations', options.startPeriod, options.endPeriod, options.locations],

        queryFn: async () => {
            const params = new URLSearchParams({
                start_date: options.startPeriod.format('YYYY-MM-DD'),
                end_date: options.endPeriod.format('YYYY-MM-DD')
            });
            if (options.locations && options.locations.length > 0){
                options.locations.forEach((location) => params.append('locations', location.toString()))
            }

            const response = await AxiosBase.get<locations>(
                `/simulation-setup/locations-vehicles?${params}`
            ).then((res) => res.data);
            if (options.callback) options.callback(response);
            return response;
        },

        select: options.selector,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        enabled: options.enabled !== undefined ? options.enabled : true
    });
}

export function useGetLocations() {
    return useQuery({
        queryKey: ['alllocations'],

        queryFn: async () => {
            return await AxiosBase.get<onlyLocations>('/simulation-setup/locations').then((res) => res.data);
        },

        refetchOnWindowFocus: false
    });
}

export function useGetForvaltninger() {
    return useQuery({
        queryKey: ['allforvaltninger'],

        queryFn: async () => {
            return await AxiosBase.get<Forvaltninger>('/simulation-setup/forvaltninger').then((res) => res.data);
        },

        refetchOnWindowFocus: false
    });
}

export default useGetVehiclesByLocation;
