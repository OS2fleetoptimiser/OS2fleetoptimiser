import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';

export type settings = {
    shift_settings: shift_settings[];
    bike_settings: bike_settings;
    simulation_settings: simulation_settings;
};

export type shift = {
    shift_start: string;
    shift_end: string;
    shift_break?: string | null;
};

export type shift_settings = {
    address?: string;
    location_id: number;
    shifts: shift[];
};

export type bike_settings = {
    max_km_pr_trip: number;
    percentage_of_trips: number;
    bike_slots: {
        bike_start: string;
        bike_end: string;
    }[];
    bike_speed: number;
    electrical_bike_speed: number;
};

export type simulation_settings = {
    el_udledning: number;
    benzin_udledning: number;
    diesel_udledning: number;
    hvo_udledning: number;
    pris_el: number;
    pris_benzin: number;
    pris_diesel: number;
    pris_hvo: number;
    vaerdisaetning_tons_co2: number;
    sub_time: number;
    high: number;
    low: number;
    distance_threshold: number;
    undriven_type: string;
    undriven_wltp: number;
    //TODO: Revisit this
    keep_data?: number;
    slack: number;
    max_undriven: number;
};

function useGetSettings<T = settings>(select?: (a: settings) => T) {
    return useQuery({
        queryKey: ['settings'],
        queryFn: () => AxiosBase.get<settings>('configuration/simulation-configurations').then((res) => res.data),
        select: select
    });
}

export default useGetSettings;
