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
    const label = isPending
        ? (pendingText ?? 'Starter simulering')
        : (pendingText
            ? `${pendingText} ${Math.round(progress)}%`
            : `${Math.round(progress)}%`)

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
                    {label}
                </Typography>
                <LinearProgress
                    variant={isPending ? 'indeterminate' : 'determinate'}
                    value={progress}
                    sx={{ width: '100%' }}
                />
                <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => setCancel()}
                >
                    {buttonText ?? 'Afbryd simulering'}
                </Button>
            </Paper>
        </Box>
    )
}

export default LoadingOverlay
