import { Vehicle } from '@/components/hooks/useGetVehicles';
import dayjs from 'dayjs';

export type VehicleStatusLabel = 'Deaktiveret' | 'Manglende metadata' | 'Testkøretøj' | 'Udløbet leasing' | 'OK';

// client side evaluation of missing data and ended leasing for the vehicle status
const hasMissingData = (vehicle: Vehicle) => {
    const cond1 = vehicle.end_leasing == null && [1, 2].includes(vehicle.leasing_type?.id || -1);
    const cond2 = vehicle.wltp_el == null && vehicle.wltp_fossil == null && vehicle.fuel?.id != 10;
    const cond3 = vehicle.omkostning_aar == null;
    return cond1 || cond2 || cond3;
};

const hasEndedLeasing = (vehicle: Vehicle) => {
    const now = dayjs();
    return dayjs(vehicle.end_leasing).isBefore(now);
};

export const getStatusLabel = (vehicle: Vehicle): VehicleStatusLabel => {
    if (vehicle.disabled) return 'Deaktiveret';
    if (hasMissingData(vehicle)) return 'Manglende metadata';
    if (vehicle.test_vehicle) return 'Testkøretøj';
    if (hasEndedLeasing(vehicle)) return 'Udløbet leasing';
    return 'OK';
};
