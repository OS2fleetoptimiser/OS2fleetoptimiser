import { Card, Typography } from '@mui/material'

export const DatesWidget = ({ startDate, endDate, manualSimulation = true }: { startDate: string; endDate: string; manualSimulation: boolean }) => {
    return (
        <Card sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                {`${manualSimulation ? 'Simulerings' : 'Optimerings'}periode`}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {`${startDate} - ${endDate}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                valgt periode
            </Typography>
        </Card>
    )
}
