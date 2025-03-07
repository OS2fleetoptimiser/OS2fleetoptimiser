import AxiosBase from '@/components/AxiosBase';
import { drivingData, drivingDataResult } from '@/components/hooks/useGetDrivingData';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import saveAs from 'file-saver';
import * as XLSX from 'xlsx';

type location = {
    id: number;
    address: string;
};

const getDrivingData = async (startDate: string, endDate: string, locationIds: number[]) => {
    const locations = locationIds.map((locId) => 'locations=' + locId).join('&');
    const result = await AxiosBase.get<drivingDataResult>(`/statistics/driving-data?start_date=${startDate}&end_date=${endDate}&${locations}`);
    return result.data;
};

const getLocations = async () => {
    const result = await AxiosBase.get<{ locations: location[] }>('configuration/dropdown-data');
    return result.data;
};

const getCars = async () => {
    const result = await AxiosBase.get<{ vehicles: Vehicle[] }>('/configuration/vehicles');
    return result.data;
};

const formatTrips = (trips: drivingData[], locationMap: location[]) => {
    // Return empty object to ensure headers are printed
    if (!trips || trips.length === 0)
        return [
            {
                Starttid: undefined,
                Sluttid: undefined,
                Turlængde: undefined,
                'Bil id': undefined,
                Lokation: undefined,
            },
        ];
    return trips.map((trip) => ({
        Starttid: trip.start_time,
        Sluttid: trip.end_time,
        Turlængde: trip.distance,
        'Bil id': trip.vehicle_id,
        Lokation: locationMap?.find((l) => l.id === trip.location_id)?.address,
    }));
};

const formatCars = (cars: Vehicle[]) => {
    if (!cars || cars.length === 0)
        return [
            {
                'Bil id': undefined,
                Nummerplade: undefined,
                Mærke: undefined,
                Model: undefined,
                'WLTP Fossil': undefined,
                'WLTP El': undefined,
                Kapacitetsnedskrivning: undefined,
                'Co2 pr km': undefined,
                Rækkevidde: undefined,
                'Årlig omkostning': undefined,
                'Start leasing': undefined,
                'Slut leasing': undefined,
                Leasingtype: undefined,
                'Km pr år': undefined,
                Hviletid: undefined,
                Lokation: undefined,
                Type: undefined,
                Drivmiddel: undefined,
            },
        ];
    return cars.map((car) => ({
        'Bil id': car.id,
        Nummerplade: car.plate,
        Mærke: car.make,
        Model: car.model,
        'WLTP Fossil': car.wltp_fossil,
        'WLTP El': car.wltp_el,
        Kapacitetsnedskrivning: car.capacity_decrease,
        'Co2 pr km': car.co2_pr_km,
        Rækkevidde: car.range,
        'Årlig omkostning': car.omkostning_aar,
        'Start leasing': car.start_leasing,
        'Slut leasing': car.end_leasing,
        Leasingtype: car.leasing_type?.name,
        'Km pr år': car.km_aar,
        Hviletid: car.sleep,
        Lokation: car.location?.address,
        Type: car.type,
        Drivmiddel: car.fuel?.name,
    }));
};

export const exportDrivingData = async (startDate: string, endDate: string, locationIds: number[]) => {
    try {
        const workBook = XLSX.utils.book_new();
        const data = await getDrivingData(startDate, endDate, locationIds);
        const locations = await getLocations();
        const formatted = formatTrips(data.driving_data, locations.locations);
        const workSheet = XLSX.utils.json_to_sheet(formatted);
        XLSX.utils.book_append_sheet(workBook, workSheet, 'Ture');

        const cars = await getCars();
        const formattedCars = formatCars(cars.vehicles);
        const carSheet = XLSX.utils.json_to_sheet(formattedCars);
        XLSX.utils.book_append_sheet(workBook, carSheet, 'Køretøjer');

        const fileBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });
        const blob = new Blob([fileBuffer], { type: 'application/vnd.ms-excel' });
        const fileName = `Ture_${startDate}_${endDate}.xlsx`;
        saveAs(blob, fileName);
    } catch (e) {
        window.alert('Der opstod en fejl download af kørselsdata. \n Fejlbesked: \n ' + e);
    }
};
