import { CarCumulative } from '@/app/(logged-in)/fleet/CarsTable';
import { Vehicle } from './hooks/useGetVehicles';

type duplicateVehicle = {
    originalVehicles: number[];
    vehicle: Vehicle;
    count: number;
};

export const reduceDuplicateVehicles = (vehicles: Vehicle[]) =>
    vehicles.reduce((acc: duplicateVehicle[], current) => {
        const duplicate = acc.find(
            (car) =>
                car.vehicle.make === current.make &&
                car.vehicle.model === current.model &&
                car.vehicle.omkostning_aar === current.omkostning_aar &&
                car.vehicle.wltp_el === current.wltp_el &&
                car.vehicle.wltp_fossil === current.wltp_fossil
        );
        if (duplicate) {
            duplicate.originalVehicles.push(current.id);
            duplicate.count++;
        } else {
            acc.push({
                originalVehicles: [current.id],
                vehicle: current,
                count: 1,
            });
        }
        return acc;
    }, []);
