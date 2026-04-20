import LinkIcon from '@mui/icons-material/Link';
import { Box, Card, CardContent, Typography } from '@mui/material';
import Link from 'next/link';

export default function KPICard({
    label,
    value,
    path,
    goToText,
    percentage = false,
    additionalIcon = null,
}: {
    label: string;
    value: number;
    path: string;
    goToText: string;
    percentage?: boolean;
    additionalIcon?: React.ReactNode;
}) {
    return (
        <Card className="relative flex-1 min-w-0">
            <CardContent className="flex flex-col">
                <Box
                    component={Link}
                    href={path}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 16,
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                    }}
                >
                    <LinkIcon sx={{ fontSize: 16, mr: 0.5, transform: 'rotate(-45deg)' }} />
                    <Typography variant="caption">{goToText}</Typography>
                </Box>
                <div className="absolute top-2 left-3">
                    <Link href={path}>{additionalIcon}</Link>
                </div>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 4 }}>
                    {`${value.toFixed(0)}${percentage ? '%' : ''}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
            </CardContent>
        </Card>
    );
}
