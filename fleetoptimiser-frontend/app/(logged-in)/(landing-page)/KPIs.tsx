'use client';
import KPICard from './KPICard';
import CommuteIcon from '@mui/icons-material/Commute';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HighlightIcon from '@mui/icons-material/Highlight';
import TableChartIcon from '@mui/icons-material/TableChart';
import { KPIs } from '@/components/hooks/useGetLandingPage';

export default function LandingPageKPIs({ data }: { data: KPIs }) {
    return (
        <div>
            {data && (
                <div className="flex flex-col md:flex-row md:flex-wrap md:gap-6 gap-4">
                    {(data.total_saved_vehicles || data.total_saved_vehicles === 0) && (
                        <KPICard
                            label="Gemte køretøjer"
                            value={data.total_saved_vehicles}
                            goToText="Konfiguration"
                            path="/configuration"
                            additionalIcon={<CommuteIcon fontSize="large" className="text-blue-500 hover:text-blue-400 rounded-2xl p-1 bg-blue-25" />}
                        />
                    )}
                    {(data.active_vehicles_last_month || data.active_vehicles_last_month === 0) && (
                        <KPICard
                            label="Aktive køretøjer seneste måned"
                            value={data.active_vehicles_last_month}
                            goToText="Køretøjsaktivitet"
                            path="/dashboard/activity"
                            additionalIcon={<TableChartIcon fontSize="large" className="text-red-500 hover:text-red-400 rounded-2xl p-1 bg-red-25" />}
                        />
                    )}
                    {(data.total_simulations_last_month || data.total_simulations_last_month === 0) && (
                        <KPICard
                            label="Simuleringer seneste måned"
                            value={data.total_simulations_last_month}
                            goToText="Simulering"
                            path="/setup"
                            additionalIcon={<AutoAwesomeIcon fontSize="large" className="text-green-500 hover:text-green-400 rounded-2xl p-1 bg-green-25" />}
                        />
                    )}
                    {(data.non_fossil_share_last_month || data.non_fossil_share_last_month === 0) && (
                        <KPICard
                            label="Andel fossilfri kørsel seneste måned"
                            value={data.non_fossil_share_last_month * 100}
                            goToText="Overblik"
                            path="/dashboard"
                            percentage
                            additionalIcon={<HighlightIcon fontSize="large" className="text-indigo-500 hover:text-indigo-400 rounded-2xl p-1 bg-indigo-25" />}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
