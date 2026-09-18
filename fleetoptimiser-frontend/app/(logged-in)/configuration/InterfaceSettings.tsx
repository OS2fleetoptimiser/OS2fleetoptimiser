import { VehicleStatusLabel } from '@/app/(logged-in)/configuration/VehicleStatus';

// one row of the vehicle export; the headers must match METADATA_COLUMNS in the backend import
export type FormattedData = {
    Status: VehicleStatusLabel;
    id: number;
    Nummerplade: string | null;
    Mærke: string | null;
    Model: string | null;
    Type: string | undefined;
    Drivmiddel: string | undefined;
    'Wltp (Fossil)': number | null;
    'Wltp (El)': number | null;
    'Procentvis WLTP': number | null;
    'Rækkevidde (km)': number | null;
    'Omk./år': number | null;
    Lokation: string | undefined;
    Afdeling: string | null;
    Forvaltning: string | null;
    'Start leasing': string | null;
    'Slut leasing': string | null;
    'Leasing type': string | undefined;
    'Kilometer pr/år': number | null;
    Hvile: number | null;
};
