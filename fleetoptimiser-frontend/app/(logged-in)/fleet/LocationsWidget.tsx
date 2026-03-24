import { Card, Typography } from '@mui/material'

export const LocationsWidget = ({ locations }: { locations: string[] }) => {
    return (
        <Card sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                Lokationer
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {locations.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                valgt til simulering
            </Typography>
        </Card>
    )
}
