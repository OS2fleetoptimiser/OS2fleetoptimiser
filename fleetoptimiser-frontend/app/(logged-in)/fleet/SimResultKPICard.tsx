import { Card, Chip, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface MetricCardProps {
    title: string;
    keyfigure: string | number;
    good: boolean;
    caption: string;
    tooltipText?: string;
    changePercent?: number;
}

export const MetricCard = ({ title, keyfigure, good, caption, tooltipText, changePercent }: MetricCardProps) => {
    const sign = changePercent !== undefined && changePercent > 0 ? '+' : '';
    return (
        <Card sx={{ p: 2, flex: 1 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {title}
                {tooltipText && (
                    <Tooltip title={tooltipText} placement="right">
                        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                )}
            </Typography>
            <div className="flex items-center gap-2">
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {keyfigure}
                </Typography>
                {changePercent !== undefined && (
                    <Chip
                        label={`${sign}${changePercent.toFixed(0)}%`}
                        size="small"
                        color={changePercent === 0 ? 'default' : good ? 'success' : 'error'}
                    />
                )}
            </div>
            <Typography variant="caption" color="text.secondary">
                {caption}
            </Typography>
        </Card>
    );
};
