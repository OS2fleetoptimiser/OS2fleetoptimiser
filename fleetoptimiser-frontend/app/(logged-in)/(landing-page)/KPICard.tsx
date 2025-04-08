import LinkIcon from '@mui/icons-material/Link';
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
        <div className="relative md:w-64 border rounded-md shadow-md bg-white p-4 flex flex-col">
            <span className="absolute top-2 right-4 text-xs text-gray-400">
                <Link className="text-gray-400 hover:text-blue-500 no-underline hover:underline flex items-center" href={path}>
                    <LinkIcon className="text-base text-gray-400 mr-1 transform -rotate-45" />
                    {goToText}
                </Link>
            </span>
            <div className="absolute top-2 left-3">
                <Link href={path}>{additionalIcon}</Link>
            </div>
            <span className="mt-8 text-2xl font-bold">{`${value.toFixed(0)}${percentage ? '%' : ''}`}</span>
            <span className="text-sm text-gray-500">{label}</span>
        </div>
    );
}
