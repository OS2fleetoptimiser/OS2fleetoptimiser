import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { useMemo } from 'react';
import { VehicleUsageTable } from './VehicleResultsTable';
import { Card, Typography } from '@mui/material';

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simulationResults.vehicleUsage.current]);

    return (
        <div className="mt-4 space-y-4">
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Simuleret køretøjsforbrug
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Detaljeret oversigt over km, udledning og omkostninger for den simulerede flådesammensætning
                </Typography>
                <VehicleUsageTable rows={simulatedVehicleUsage} />
            </Card>
            <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                    Nuværende køretøjsforbrug
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    Detaljeret oversigt over km, udledning og omkostninger for den nuværende flådesammensætning
                </Typography>
                <VehicleUsageTable rows={currentVehicleUsage} />
            </Card>
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
