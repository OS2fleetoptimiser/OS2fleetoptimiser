'use client';

import { Collapse, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MemoryIcon from '@mui/icons-material/Memory';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAppSelector } from '@/components/redux/hooks';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MapsHomeWorkIcon from '@mui/icons-material/MapsHomeWork';
import CommuteIcon from '@mui/icons-material/Commute';
import LogoutIcon from '@mui/icons-material/Logout';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { signOut } from 'next-auth/react';


type Props = {
    logoutRedirect: string;
};

const TopNavigation = ({ logoutRedirect }: Props) => {
    const pathname = usePathname();

    const isSelected = (path: string, contains: boolean = false) => {
        return pathname === path || (contains && pathname.includes(path))
    };

    const isSubItemSelected = (path: string) => {
        return pathname.startsWith(path);
    };

    const isConfSelected = () => {
        return pathname.includes('location') || pathname.includes('configuration')
    }

    const isSimSelect = () => {
        return pathname.includes('goal') || pathname.includes('fleet') || pathname === '/' || pathname.includes('simulation-history')
    }

    const router = useRouter();

    // User must choose cars that have been driven in the given period to continue
    const disableSimulationLink = useAppSelector(
        (state) =>
            state.simulation.selectedVehicles.filter((car) => car.status === 'ok' || car.status === 'locationChanged' || car.status === 'leasingEnded')
                .length === 0
    );

    const disableGoalLink = useAppSelector((state) => {
        const filteredVehicles = state.simulation.selectedVehicles.filter(
            (car) => car.status === 'ok' || car.status === 'locationChanged' || car.status === 'leasingEnded'
        );
        return filteredVehicles.length === 0 || filteredVehicles.length > 100;
    });

    const [dashboardDropDownOpen, setDashboardDropDownOpen] = useState(false);
    const [configurationDropDownOpen, setConfigurationDropDownOpen] = useState(false);
    const [simDropDownOpen, setSimDropDownOpen] = useState(true);

    const handleClick = () => {
        setDashboardDropDownOpen(!dashboardDropDownOpen);
    };
    const handeConfClick = () => {
        setConfigurationDropDownOpen(!configurationDropDownOpen);
    }

    const handleSimClick = () => {
        setSimDropDownOpen(!simDropDownOpen);
    }

    return (
        <nav className="hidden md:visible md:flex flex-col w-76 h-screen fixed top-0 left-0 custom-nav">
            <div className="p-4 flex items-center mb-4 mt-2">
                <Image alt="logo" src="/logo_shadows_transparent.png" width={47} height={35} quality={100} />
                <Typography variant="h3">
                    <span className="ml-2">FleetOptimiser</span>
                </Typography>
            </div>
            <List>
                <ListItem disablePadding>
                    <ListItemButton onClick={handleSimClick} selected={isSimSelect()}>
                        <ListItemIcon>
                            <AutoAwesomeIcon />
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Simulering" />
                        <div className="mr-4">{simDropDownOpen ? <ExpandLess /> : <ExpandMore />}</div>
                    </ListItemButton>
                </ListItem>

                <Collapse in={simDropDownOpen} timeout="auto" unmountOnExit>
                    <Suspense>
                        <Link className="no-underline" href={'/'}>
                            <ListItem disablePadding>
                                <ListItemButton selected={isSelected('/')}>
                                    <ListItemIcon className="ml-4">
                                        <FormatListBulletedIcon />
                                    </ListItemIcon>
                                    <ListItemText className="text-black" primary="Simuleringssetup" />
                                </ListItemButton>
                            </ListItem>
                        </Link>
                        <ListItem disablePadding>
                            <ListItemButton onClick={() => router.push('/fleet')} disabled={disableSimulationLink} selected={isSelected('/fleet')}>
                                <ListItemIcon className="ml-4">
                                    <DirectionsCarIcon />
                                </ListItemIcon>
                                <ListItemText className="text-black" primary="Manuel simulering" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            {disableGoalLink ? (
                                <Tooltip title="Automatisk simulering er deaktiveret, hvis ingen eller over 100 køretøjer er valgt.">
                                    <span>
                                        <ListItemButton onClick={() => router.push('/goal')} disabled={disableGoalLink} selected={isSelected('/goal')}>
                                            <ListItemIcon className="ml-4">
                                                <MemoryIcon />
                                            </ListItemIcon>
                                            <ListItemText className="text-black" primary="Automatisk simulering" />
                                        </ListItemButton>
                                    </span>
                                </Tooltip>
                            ) : (
                                <ListItemButton onClick={() => router.push('/goal')} disabled={disableGoalLink} selected={isSelected('/goal')}>
                                    <ListItemIcon className="ml-4">
                                        <MemoryIcon />
                                    </ListItemIcon>
                                    <ListItemText className="text-black" primary="Automatisk simulering" />
                                </ListItemButton>
                            )}
                        </ListItem>
                        <Link className="no-underline" href="/simulation-history">
                            <ListItem disablePadding>
                                <ListItemButton selected={isSelected('/simulation-history')}>
                                    <ListItemIcon className="ml-4">
                                        <WorkHistoryIcon />
                                    </ListItemIcon>
                                    <ListItemText className="text-black" primary="Simuleringshistorik" />
                                </ListItemButton>
                            </ListItem>
                        </Link>
                    </Suspense>
                </Collapse>
                <Divider />
                <ListItem disablePadding>
                    <ListItemButton onClick={handleClick} selected={isSubItemSelected('/dashboard')}>
                        <ListItemIcon>
                            <QueryStatsIcon />
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Dashboards" />
                        <div className="mr-4">{dashboardDropDownOpen ? <ExpandLess /> : <ExpandMore />}</div>
                    </ListItemButton>
                </ListItem>
                <Collapse in={dashboardDropDownOpen} timeout="auto" unmountOnExit>
                    <Suspense fallback={<DashBoardNavNoParams isSelected={isSelected}></DashBoardNavNoParams>}>
                        <DashboardNavWithParams isSelected={isSelected}></DashboardNavWithParams>
                    </Suspense>
                </Collapse>
                <Divider />
                <ListItem disablePadding>
                    <ListItemButton onClick={handeConfClick} selected={isConfSelected()}>
                        <ListItemIcon>
                            <AdminPanelSettingsIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Konfiguration"/>
                        <div className="mr-4">{configurationDropDownOpen ? <ExpandLess /> : <ExpandMore />}</div>
                    </ListItemButton>
                </ListItem>
                <Collapse in={configurationDropDownOpen} timeout="auto" unmountOnExit>
                    <Suspense>
                        <ConfigurationNav isSelected={isSelected}></ConfigurationNav>
                    </Suspense>
                </Collapse>
                <Divider />

                <Link className="no-underline" href={'https://sway.cloud.microsoft/eMfBIhsk5ImWaxoX?ref=Link'} target="_blank">
                    <ListItem disablePadding>
                        <ListItemButton>
                            <ListItemIcon>
                                <MenuBookIcon />
                            </ListItemIcon>
                            <ListItemText className="text-black" primary="Brugervejledning" />
                        </ListItemButton>
                    </ListItem>
                </Link>
            </List>
            <List className="mt-auto">
                <Divider />
                <ListItem disablePadding>
                    <ListItemButton
                        onClick={async (e) => {
                            await signOut({ redirect: false }).then(() => router.push(logoutRedirect));
                        }}
                    >
                        <ListItemIcon>
                            <LogoutIcon />
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Log ud" />
                    </ListItemButton>
                </ListItem>
            </List>
        </nav>
    );
};

const DashboardNavWithParams = ({ isSelected }: { isSelected: (s: string) => boolean }) => {
    const searchParams = useSearchParams();

    return (
        <List component="div" disablePadding>
            <Link className="no-underline" href={{ pathname: '/dashboard', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard')}>
                        <ListItemText className="text-black" primary="Overblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/driving', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/driving')}>
                        <ListItemText className="text-black" primary="Kørsel" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/activity', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/activity')}>
                        <ListItemText className="text-black" primary="Køretøjsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/timeactivity', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/timeactivity')}>
                        <ListItemText className="text-black" primary="Tidsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/trip-segments', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/trip-segments')}>
                        <ListItemText className="text-black" primary="Turoverblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/availability', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/availability')}>
                        <ListItemText className="text-black" primary="Ledighed" />
                    </ListItemButton>
                </ListItem>
            </Link>
        </List>
    );
};

const DashBoardNavNoParams = ({ isSelected }: { isSelected: (s: string) => boolean }) => {
    return (
        <List component="div" disablePadding>
            <Link className="no-underline" href={{ pathname: '/dashboard' }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard')}>
                        <ListItemText className="text-black" primary="Overblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/driving' }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/driving')}>
                        <ListItemText className="text-black" primary="Kørsel" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/activity' }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/activity')}>
                        <ListItemText className="text-black" primary="Køretøjsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/trip-segments' }}>
                <ListItem disablePadding>
                    <ListItemButton className="pl-16" selected={isSelected('/dashboard/trip-segments')}>
                        <ListItemText className="text-black" primary="Turoverblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
        </List>
    );
};

const ConfigurationNav = ({ isSelected }: { isSelected: (s: string, c: boolean) => boolean}) => {
    return (
        <List component="div" disablePadding>
            <Link className="no-underline" href={'/configuration'}>
            <ListItem disablePadding>
                <ListItemButton selected={isSelected('/configuration', false)}>
                    <ListItemIcon className="ml-4">
                        <CommuteIcon />
                    </ListItemIcon>
                    <ListItemText className="text-black" primary="Køretøjer" />
                </ListItemButton>
            </ListItem>
            </Link>
                <Link className="no-underline" href={'/location'}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/location', true)}>
                        <ListItemIcon className="ml-4">
                            <MapsHomeWorkIcon />
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Lokationer" />
                    </ListItemButton>
                </ListItem>
            </Link>
        </List>
    )
}

export default TopNavigation;
