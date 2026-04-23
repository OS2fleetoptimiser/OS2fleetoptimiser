import { Box, Paper, Typography } from '@mui/material';

export type ChartTooltipRow = {
    label: React.ReactNode;
    value: React.ReactNode;
};

type ChartTooltipProps = {
    title?: React.ReactNode;
    accentColor?: string;
    rows: ChartTooltipRow[];
    footer?: React.ReactNode;
};

const labelSx = { fontSize: '0.75rem', lineHeight: 1.3 };

const ChartTooltip = ({ title, accentColor, rows, footer }: ChartTooltipProps) => {
    return (
        <Paper
            elevation={3}
            sx={{
                maxWidth: 480,
                borderRadius: 1,
                px: 1,
                py: 0.625,
                border: '1px solid',
                borderColor: 'divider',
                pointerEvents: 'none',
            }}
        >
            {title && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {accentColor && (
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '2px',
                                bgcolor: accentColor,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <Typography
                        color="text.primary"
                        sx={{ ...labelSx, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                        {title}
                    </Typography>
                </Box>
            )}
            {rows.length > 0 && (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'max-content auto',
                        columnGap: 2.5,
                        rowGap: 0.5,
                        alignItems: 'center',
                        mt: title ? 0.5 : 0,
                    }}
                >
                    {rows.map((row, index) => (
                        <Box key={index} sx={{ display: 'contents' }}>
                            <Typography color="text.secondary" sx={{ ...labelSx, whiteSpace: 'nowrap' }}>
                                {row.label}
                            </Typography>
                            <Typography
                                color="text.primary"
                                sx={{ ...labelSx, fontWeight: 600, whiteSpace: 'nowrap', justifySelf: 'end' }}
                            >
                                {row.value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
            {footer && (
                <Typography
                    color="text.secondary"
                    sx={{ ...labelSx, display: 'block', mt: 0.5 }}
                >
                    {footer}
                </Typography>
            )}
        </Paper>
    );
};

export default ChartTooltip;
