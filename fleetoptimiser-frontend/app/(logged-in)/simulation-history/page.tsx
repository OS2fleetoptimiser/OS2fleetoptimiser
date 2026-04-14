'use client';

import { useState } from 'react';
import { useGetFleetSimulationHistory, useGetGoalSimulationHistory } from '@/components/hooks/useGetSimulationHistory';
import {
    Skeleton,
    Divider,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography,
} from '@mui/material';
import PageTitle from '@/components/PageTitle';
import dayjs from 'dayjs';
import TuneIcon from '@mui/icons-material/Tune';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { useRouter } from 'next/navigation';

type SimulationHistory = {
    id: string;
    start_date: string;
    end_date: string;
    location: string;
    locations?: string;
    simulation_date: string;
};

function HistoryTable({ data, basePath, loading }: { data?: SimulationHistory[]; basePath: string; loading: boolean }) {
    const router = useRouter();

    if (loading) {
        return (
            <div className="py-4">
                <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
                {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} variant="text" height={32} sx={{ mb: 0.5 }} />
                ))}
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                Ingen simuleringer fundet.
            </Typography>
        );
    }

    return (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>Dato</TableCell>
                        <TableCell>Lokation(er)</TableCell>
                        <TableCell>Periode</TableCell>
                        <TableCell align="right" sx={{ width: 48 }}></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((history) => (
                        <TableRow
                            key={history.id}
                            onClick={() => router.push(`${basePath}/${history.id}`)}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <CalendarTodayOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    {dayjs(history.simulation_date).format('DD-MM-YYYY')}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <LocationOnOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    {history.locations ? history.locations : history.location}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {history.start_date}
                                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    {history.end_date}
                                </div>
                            </TableCell>
                            <TableCell align="right">
                                <ChevronRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default function Page() {
    const [tab, setTab] = useState(0);
    const fleetSimulationHistory = useGetFleetSimulationHistory();
    const goalSimulationHistory = useGetGoalSimulationHistory();

    return (
        <>
            <PageTitle
                title="Simuleringshistorik"
                subtitle="Oversigt over tidligere simuleringer kørt på systemet."
            />
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                aria-label="Simuleringstype"
            >
                <Tab
                    value={0}
                    label="Manuel simulering"
                    icon={<TuneIcon />}
                    iconPosition="start"
                />
                <Tab
                    value={1}
                    label="Automatisk simulering"
                    icon={<AutoFixHighIcon />}
                    iconPosition="start"
                />
            </Tabs>
            <Divider />
            <div className="mt-4">
                {tab === 0 && (
                    <HistoryTable
                        data={fleetSimulationHistory.data}
                        basePath="/fleet"
                        loading={fleetSimulationHistory.isLoading}
                    />
                )}
                {tab === 1 && (
                    <HistoryTable
                        data={goalSimulationHistory.data}
                        basePath="/goal"
                        loading={goalSimulationHistory.isLoading}
                    />
                )}
            </div>
        </>
    );
}
