import { useQuery } from '@tanstack/react-query';
import AxiosBase from '../AxiosBase';
import { Vehicle } from './useGetVehicles';

function useGetUniqueVehicles() {
    return useQuery({
        queryKey: ['vehicles'],
        queryFn: () => AxiosBase.get<{ vehicles: Vehicle[] }>('configuration/vehicles').then((response) => response.data),

        select: (data) =>
            data.vehicles.reduce((acc: Vehicle[], cur) => {
                if (
                    !acc.find(
                        (car) =>
                            car.make === cur.make &&
                            car.model === cur.model &&
                            car.wltp_fossil === cur.wltp_fossil &&
                            car.wltp_el === cur.wltp_el &&
                            car.omkostning_aar === cur.omkostning_aar
                    )
                ) {
                    acc.push(cur);
                }
                return acc;
            }, [])
    });
}

export default useGetUniqueVehicles;
