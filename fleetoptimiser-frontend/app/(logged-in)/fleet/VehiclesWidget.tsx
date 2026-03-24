import { Button, Card, Typography } from '@mui/material'
import ExtraVehicleModal from '@/app/(logged-in)/fleet/ExtraVehiclesModal'
import { SimulationSettingsWidget } from '@/app/(logged-in)/fleet/SimulationSettingsWidget'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { useMemo } from 'react'
import { VehiclesSelectionTable } from '@/app/(logged-in)/fleet/VehiclesSelection'
import { useAppSelector } from '@/components/redux/hooks'
import { duplicateVehicle, reduceDuplicateVehicles } from '@/components/DuplicateReducer'
import { Vehicle } from '@/components/hooks/useGetVehicles'

export type ReducedVehicleGroup = {
    vehicle: Vehicle
    count: number
    groupIds: number[]
    extra: boolean
}

type VehiclesWidgetProps = {
    manualSimulation: boolean
    onStart?: () => void
    startDisabled?: boolean
}

export const VehiclesWidget = ({ manualSimulation, onStart, startDisabled }: VehiclesWidgetProps) => {
    const currentGroups: duplicateVehicle[] = useAppSelector((state) => reduceDuplicateVehicles(state.simulation.selectedVehicles))
    const extraGroups: duplicateVehicle[] = useAppSelector((state) => reduceDuplicateVehicles(state.simulation.fleetSimulationSettings.extraVehicles))
    const fleet: ReducedVehicleGroup[] = useMemo(() => {
        return [
            ...currentGroups.map((group) => ({
                vehicle: group.vehicle,
                extra: false,
                count: group.count,
                groupIds: group.originalVehicles,
            })),
            ...extraGroups.map((group) => ({
                vehicle: group.vehicle,
                extra: true,
                count: 0,
                groupIds: [],
            })),
        ]
    }, [currentGroups, extraGroups])

    return (
        <Card sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                Køretøjer i {manualSimulation ? 'simulering' : 'optimering'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Juster antal køretøjer der skal indgå i {manualSimulation ? 'simuleringen' : 'optimeringen'}, eller tilføj testkøretøjer.
            </Typography>
            <div className="flex gap-2 justify-end mb-2">
                <SimulationSettingsWidget manualSimulation={manualSimulation} />
                <ExtraVehicleModal buttonAppearance={true} />
            </div>
            <VehiclesSelectionTable manualSimulation={manualSimulation} vehicles={fleet} />
            {onStart && (
                <div className="mt-3 flex justify-end">
                    <Button
                        onClick={onStart}
                        disabled={startDisabled}
                        color="primary"
                        variant="contained"
                        endIcon={<ArrowForwardIosIcon />}
                    >
                        Start {manualSimulation ? 'simulering' : 'optimering'}
                    </Button>
                </div>
            )}
        </Card>
    )
}
