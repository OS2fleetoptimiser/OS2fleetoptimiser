import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import ToolTip from '@/components/ToolTip';
import { useMemo } from 'react';
import { VehicleUsageTable } from './VehicleResultsTable';

export interface VehicleUsageRow {
    Koeretoej: string;
    Allokerede_km: number;
    Aarlig_km: number;
    WLTP: string;
    Udledning_allokeret: number;
    Aarlig_udledning: number;
    Aarlig_omkostning: number;
    Aarlig_driftsomkostning: number;
    Aarlig_samfundsoekonomisk: number;
    Samlet_aarlig_omkostning: number;
}


export const VehicleResults = ({ simulationResults }: { simulationResults: SimulationResults }) => {
    const simulatedVehicleUsage = useMemo(() => {
        return simulationResults.vehicleUsage.simulation.map((item) => convertUsageItemToRow(item));
    }, [simulationResults.vehicleUsage.simulation]);
    const currentVehicleUsage = useMemo(() => {
        return simulationResults.vehicleUsage.current.map((item) => convertUsageItemToRow(item));
    }, [simulationResults.vehicleUsage.current]);

    return (
        <div className="mt-4 p-4 border border-gray-100 rounded-md shadow-sm">
            <span className="font-bold text-sm">Detaljer om køretøjsforbrug i simulerede og nuværende flåde</span>
            <ToolTip>
                Se hvilke effekter det har på din køreplan og flåde ved at simulere med en ny flådesammensætning. Du kan se de aktivt allokerede km på hvert
                køretøj og hvad det resulterer i over et år. Udgifterne forbundet med køretøjet, både omkostning - og udledningsmæssigt forbrug bliver også
                vist.
            </ToolTip>
            <div className="mt-2 mb-6 space-y-2">
                <span className="font-semibold text-sm">Simuleret forbrug</span>
                <VehicleUsageTable rows={simulatedVehicleUsage} />
            </div>
            <div className="space-y-2">
                <span className="font-semibold text-sm">Nuværende forbrug</span>
                <VehicleUsageTable rows={currentVehicleUsage} />
            </div>
        </div>
    );
};


function convertUsageItemToRow(item: any): VehicleUsageRow {
    return {
        Koeretoej: item['Køretøj'] || '',
        Allokerede_km: getNumberValue(item['Allokerede km']),
        Aarlig_km: getNumberValue(item['Årlig km']),
        WLTP: typeof item['WLTP'] === 'object' ? item['WLTP'].source : item['WLTP'] || '',
        Udledning_allokeret: getNumberValue(item['Udledning for allokeret (kg CO2e)']),
        Aarlig_udledning: getNumberValue(item['Årlig udledning (kg CO2e)']),
        Aarlig_omkostning: getNumberValue(item['Årlig Omkostning kr']),
        Aarlig_driftsomkostning: getNumberValue(item['Årlig Driftsomkostning kr']),
        Aarlig_samfundsoekonomisk: getNumberValue(item['Årlig Samfundsøkonomisk Omkostning kr']),
        Samlet_aarlig_omkostning: getNumberValue(item['Samlet Årlig Omkostning kr']),
    };
}

function getNumberValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
        return value.parsedValue ?? 0;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}
