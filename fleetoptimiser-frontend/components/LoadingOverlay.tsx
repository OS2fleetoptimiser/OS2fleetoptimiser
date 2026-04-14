import { Box, Button, LinearProgress, Paper, Typography } from '@mui/material'

type props = {
    progress: number
    status: string
    setCancel: () => void
    buttonText?: string
    pendingText?: string
}

const LoadingOverlay = ({ progress, status, setCancel, buttonText, pendingText }: props) => {
    const isPending = status === 'PENDING'
    const rounded = Math.round(progress)

    return (
        <Box
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: 1300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(4px)',
            }}
        >
            <Paper
                variant="outlined"
                sx={{
                    width: '100%',
                    maxWidth: 420,
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2.5,
                }}
            >
                <Typography variant="subtitle2">
                    {pendingText ?? (isPending ? 'Starter simulering' : 'Simulerer')}
                </Typography>
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <LinearProgress
                        variant={isPending ? 'indeterminate' : 'determinate'}
                        value={progress}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', visibility: isPending ? 'hidden' : 'visible' }}>
                        {rounded}%
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={setCancel}
                >
                    {buttonText ?? 'Afbryd simulering'}
                </Button>
            </Paper>
        </Box>
    )
}

export default LoadingOverlay
