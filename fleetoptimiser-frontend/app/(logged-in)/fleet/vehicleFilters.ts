import { Vehicle } from '@/components/hooks/useGetVehicles';

export const filterPreselectedVehicles = (availableVehicles: Vehicle[], selectedVehicles: Vehicle[]) =>
    availableVehicles.filter((v) => {
        const hasYearlyCost = v.omkostning_aar != null;
        const hasConsumption = v.wltp_el != null || v.wltp_fossil != null;
        const isBike = (v.type?.id === 1 || v.type?.id === 2) && v.fuel?.id === 10;
        const meetsConditions = hasYearlyCost && (hasConsumption || isBike);

        const isAlreadySelected = selectedVehicles.some(
            (car) =>
                car.make === v.make &&
                car.model === v.model &&
                car.omkostning_aar === v.omkostning_aar &&
                car.wltp_el === v.wltp_el &&
                car.wltp_fossil === v.wltp_fossil
        );

        return meetsConditions && !isAlreadySelected;
    });

export const filterVehiclesBySearch = (vehicles: Vehicle[], query: string) => {
    if (!query.trim()) return vehicles;
    const lowerQuery = query.toLowerCase();
    return vehicles.filter((v) => {
        const make = v.make?.toLowerCase() || '';
        const model = v.model?.toLowerCase() || '';
        return make.includes(lowerQuery) || model.includes(lowerQuery);
    });
};
