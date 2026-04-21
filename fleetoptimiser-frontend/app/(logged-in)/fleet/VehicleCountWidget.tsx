import { Card, Typography } from '@mui/material'
import { useAppSelector } from '@/components/redux/hooks'

export const VehicleCountWidget = ({ manualSimulation }: { manualSimulation: boolean }) => {
    const totalSimulation = useAppSelector((state) =>
        state.simulation.fleetSimulationSettings.simulation_vehicles.reduce(
            (acc, curr) => acc + curr.simulation_count,
            0
        )
    )
    const totalCurrent = useAppSelector((state) => state.simulation.selectedVehicles.length)

    const name = manualSimulation ? 'simulering' : 'optimering'
    const delta = totalSimulation - totalCurrent

    return (
        <Card sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1 }}>
                Køretøjer
            </Typography>
            <div className="flex justify-between">
                <Typography variant="caption" color="text.secondary">
                    Nuværende flåde
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {totalCurrent}
                </Typography>
            </div>
            <div className="flex justify-between">
                <Typography variant="caption" color="text.secondary">
                    Ændring
                </Typography>
                <Typography
                    variant="caption"
                    sx={{ fontWeight: 600 }}
                    color={delta > 0 ? 'error.main' : delta < 0 ? 'success.main' : 'text.primary'}
                >
                    {delta > 0 ? '+' : ''}{delta}
                </Typography>
            </div>
            <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                <Typography variant="caption" color="text.secondary">
                    I {name}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {totalSimulation}
                </Typography>
            </div>
        </Card>
    )
}
