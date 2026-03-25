import { Button, Card, Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material'
import { SimulationSettingsWidget } from '@/app/(logged-in)/fleet/simulation-settings/SimulationSettingsDialog'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { useMemo, useState } from 'react'
import { TestVehiclesPage } from '@/app/(logged-in)/fleet/TestVehiclesPage'
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
    const [vehiclesOpen, setVehiclesOpen] = useState(false)
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
                <Button size="small" onClick={() => setVehiclesOpen(true)} variant="outlined" color="inherit" startIcon={<AddIcon />}>
                    Tilføj køretøjer
                </Button>
            </div>
            <Dialog open={vehiclesOpen} onClose={() => setVehiclesOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fcfcfc' }}>
                    <Typography variant="h6" component="span">Tilføj køretøjer</Typography>
                    <IconButton onClick={() => setVehiclesOpen(false)} size="small" aria-label="luk">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 3 }}>
                    <TestVehiclesPage />
                </DialogContent>
            </Dialog>
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
