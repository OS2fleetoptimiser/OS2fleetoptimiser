import ToolTip from '@/components/ToolTip';

interface MetricCardProps {
    title: string;
    keyfigure: string | number;
    basefigure: string | number;
    good: boolean;
    tooltipText?: string;
}

export const MetricCard = ({ title, keyfigure, basefigure, good, tooltipText }: MetricCardProps) => {
    return (
        <div className="rounded-md shadow-sm border border-gray-100 bg-white p-4 pt-2">
            <div className="flex text-gray-500 text-sm items-center">
                {title}
                {tooltipText && <ToolTip>{tooltipText}</ToolTip>}
            </div>
            <div className="flex items-baseline justify-between mt-2">
                <span className={`text-xl font-bold ${good ? 'text-green-600' : 'text-red-600'}`}>{keyfigure}</span>
                <span className="text-sm text-gray-500">/ {basefigure}</span>
            </div>
        </div>
    );
};
