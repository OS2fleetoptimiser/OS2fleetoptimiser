import { FormattedData } from '@/app/(logged-in)/configuration/InterfaceSettings';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export function formatDataForExport(originalData: Vehicle[]): FormattedData[] {
    return originalData.map((data) => ({
        id: data.id,
        Nummerplade: data.plate,
        Mærke: data.make,
        Model: data.model,
        Type: data.type?.name,
        Drivmiddel: data.fuel?.name,
        'Wltp (Fossil)': data.wltp_fossil,
        'Wltp (El)': data.wltp_el,
        'Procentvis WLTP': data.capacity_decrease,
        'Rækkevidde (km)': data.range,
        'Omk./år': data.omkostning_aar,
        Lokation: data.location?.address,
        Afdeling: data.department,
        Forvaltning: data.forvaltning,
        'Start leasing': data.start_leasing ? dayjs(data.start_leasing).format('DD-MM-YYYY') : null,
        'Slut leasing': data.end_leasing ? dayjs(data.end_leasing).format('DD-MM-YYYY') : null,
        'Leasing type': data.leasing_type?.name,
        'Kilometer pr/år': data.km_aar,
        Hvile: data.sleep,
    }));
}

export function exportDataToXlsx(columns: { header: string }[], vehicleData: any[]) {
    const formattedData = formatDataForExport(vehicleData);
    const sheetName = 'Sheet1';
    const workBook = XLSX.utils.book_new();
    const workSheet = XLSX.utils.json_to_sheet(formattedData);
    XLSX.utils.book_append_sheet(workBook, workSheet, sheetName);
    const fileBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });
    const blob = new Blob([fileBuffer], { type: 'application/vnd.ms-excel' });
    const fileName = 'Oversigt_over_flåde.xlsx'; // TODO Nanvet skal nok ændres på den fil der bliver gemt.
    saveAs(blob, fileName);
}
