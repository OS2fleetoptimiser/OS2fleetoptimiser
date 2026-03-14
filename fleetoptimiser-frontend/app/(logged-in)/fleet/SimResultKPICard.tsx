import ToolTip from '@/components/ToolTip';
import { Card, CardContent } from '@mui/material';

interface MetricCardProps {
    title: string;
    keyfigure: string | number;
    basefigure: string | number;
    good: boolean;
    tooltipText?: string;
}

export const MetricCard = ({ title, keyfigure, basefigure, good, tooltipText }: MetricCardProps) => {
    return (
        <Card>
            <CardContent sx={{ pt: 1 }}>
                <div className="flex text-gray-500 text-sm items-center">
                    {title}
                    {tooltipText && <ToolTip>{tooltipText}</ToolTip>}
                </div>
                <div className="flex items-baseline justify-between mt-2">
                    <span className={`text-xl font-bold ${good ? 'text-green-600' : 'text-red-600'}`}>{keyfigure}</span>
                    <span className="text-sm text-gray-500">/ {basefigure}</span>
                </div>
            </CardContent>
        </Card>
    );
};
