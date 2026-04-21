import { ReducedVehicleGroup } from '@/app/(logged-in)/fleet/VehiclesWidget'
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks'
import { setGoalSimulationVehicles, setSimulationVehicle } from '@/components/redux/SimulationSlice'
import { IconButton, Tooltip } from '@mui/material'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'

type InputVehicleCountProps = {
    reducedVehicleGroup: ReducedVehicleGroup
    restrict: boolean
}

export const InputVehicleCount = ({ reducedVehicleGroup, restrict }: InputVehicleCountProps) => {
    const { vehicle, count: availableCount, extra, groupIds } = reducedVehicleGroup

    const dispatch = useAppDispatch()
    const simulationCount = useAppSelector(
        (state) => state.simulation.fleetSimulationSettings.simulation_vehicles.find((c) => c.id === vehicle.id)?.simulation_count ?? 0
    )

    const allGoalSimulationVehicles = useAppSelector((state) => state.simulation.goalSimulationSettings.fixed_vehicles)

    const updateCount = (newCount: number) => {
        if (restrict) {
            if (availableCount === 0) {
                newCount = 0
            } else if (newCount > availableCount) {
                return
            }
        }

        let updatedFixedVehicles = allGoalSimulationVehicles.filter((vid) => !groupIds.includes(vid))
        const idsToAdd = groupIds.slice(0, newCount)
        updatedFixedVehicles = updatedFixedVehicles.concat(idsToAdd)

        dispatch(setGoalSimulationVehicles(updatedFixedVehicles))
        dispatch(setSimulationVehicle({ id: vehicle.id, simulation_count: newCount }))
    }

    const handleIncrement = () => {
        if (!restrict || simulationCount < availableCount) {
            updateCount(simulationCount + 1)
        }
    }

    const handleDecrement = () => {
        if (simulationCount > 0) {
            updateCount(simulationCount - 1)
        }
    }

    const handleChange = (val: string) => {
        const newCount = +val
        if (Number.isNaN(newCount)) return
        if (restrict && newCount > availableCount) return
        updateCount(newCount)
    }

    const adjustmentDisabled = restrict && extra
    const increaseAboveCurrentDisabled = restrict && simulationCount === availableCount

    const goalTestVehicleText =
        'Du har valgt køretøjet som et testkøretøj til simuleringen. Det betyder, at den nu kan benyttes af AI-modellen i flådesammensætning, hvis det er fordelagtigt i løsningen.'
    const goalVehicleMax =
        'Du kan ikke selv tilføje flere end det nuværende antal af køretøjstypen. Optimering tilføjer selv flere, hvis det er fordelagtigt for løsningen.'
    const tooltipText = restrict ? (extra && goalTestVehicleText) || (simulationCount == availableCount && goalVehicleMax) || '' : ''

    return (
        <div className="flex items-center gap-1">
            <IconButton
                size="small"
                disabled={adjustmentDisabled || simulationCount === 0}
                onClick={handleDecrement}
                className="hidden md:flex"
            >
                <RemoveIcon fontSize="small" />
            </IconButton>
            <input
                type="number"
                disabled={adjustmentDisabled}
                value={simulationCount}
                onChange={(e) => handleChange(e.target.value)}
                min={0}
                max={restrict ? availableCount : 9999}
                className="w-10 text-center text-sm rounded bg-gray-100 py-1 border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Tooltip title={tooltipText}>
                <span>
                    <IconButton
                        size="small"
                        disabled={adjustmentDisabled || increaseAboveCurrentDisabled}
                        onClick={handleIncrement}
                        className="hidden md:flex"
                    >
                        <AddIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </div>
    )
}
