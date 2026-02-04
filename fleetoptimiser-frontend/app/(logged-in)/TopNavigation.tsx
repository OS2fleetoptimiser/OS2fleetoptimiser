'use client';

import { Collapse, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MemoryIcon from '@mui/icons-material/Memory';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {useAppDispatch, useAppSelector} from '@/components/redux/hooks';
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
import HighlightIcon from '@mui/icons-material/Highlight';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TimelineIcon from '@mui/icons-material/Timeline';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import TableChartIcon from '@mui/icons-material/TableChart';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import HomeIcon from '@mui/icons-material/Home';
import { signOut } from '@/lib/auth-client';
import { prepareGoalSimulation } from "@/components/redux/SimulationSlice";

type Props = {
    logoutRedirect: string;
};

const TopNavigation = ({ logoutRedirect }: Props) => {
    const [showNavBar, setShowNavBar] = useState<boolean>(false);
    const pathname = usePathname();

    const dispatch = useAppDispatch();

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
        return pathname.includes('goal') || pathname.includes('fleet') || pathname.includes('setup') || pathname.includes('simulation-history')
    }

    const router = useRouter();

    // User must choose cars that have been driven in the given period to continue
    const disableSimulationLink = useAppSelector(
        (state) =>
            state.simulation.selectedVehicles.filter((car) => car.status === 'ok' || car.status === 'locationChanged')
                .length === 0
    );

    const disableGoalLink = useAppSelector((state) => {
        const filteredVehicles = state.simulation.selectedVehicles.filter(
            (car) => car.status === 'ok' || car.status === 'locationChanged'
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

    const toggleNavBar = () => {
        setShowNavBar(!showNavBar)
    }
    return (
        <>
        <div className="top-0 left-0 p-4 fixed z-[50] md:hidden sm:visible w-76 flex">
            {
                !showNavBar && <MenuOutlinedIcon className="hover:scale-103 cursor-pointer" fontSize="large" onClick={toggleNavBar}/>
            }
            {
                showNavBar && <div className="ml-auto cursor-pointer flex" onClick={toggleNavBar}>
                    <span>Skjul</span>
                    <KeyboardDoubleArrowLeftIcon className="hover:scale-103" fontSize="medium"/>
                </div>
            }
        </div>
        <nav className={`fixed top-0 left-0 w-76 h-screen z-[49] custom-nav overflow-auto pt-8 md:pt-0 md:flex flex-col transition-all duration-300 ease-in-out 
        ${showNavBar ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none md:opacity-100 md:translate-x-0 md:pointer-events-auto'}`}
        >
            <div className="p-4 flex items-center mb-4 mt-2">
                <Image alt="logo" src="/logo_shadows_transparent.png" width={47} height={35} unoptimized/>
                <Typography variant="h3">
                    <span className="ml-2">FleetOptimiser</span>
                </Typography>
            </div>
            <List>
                <Link className="no-underline" href={'/'}>
                    <ListItem disablePadding>
                        <ListItemButton selected={isSelected('/')}>
                            <ListItemIcon>
                                <HomeIcon/>
                            </ListItemIcon>
                            <ListItemText className="text-black" primary="Forside" />
                        </ListItemButton>
                    </ListItem>
                </Link>
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
                        <Link className="no-underline" href={'/setup'}>
                            <ListItem disablePadding>
                                <ListItemButton selected={isSelected('/setup')}>
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
                                <ListItemButton
                                    onClick={async () => {
                                        await dispatch(prepareGoalSimulation());
                                        router.push('/goal');
                                    }}
                                    disabled={disableGoalLink}
                                    selected={isSelected('/goal')}>
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

                <Link className="no-underline" href={'https://os2fleetoptimiser.github.io/os2fleetoptimiser-user-guide/'} target="_blank">
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
                        onClick={async () => {
                            await signOut();
                            router.push(logoutRedirect);
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
        </>
    );
};

const DashboardNavWithParams = ({ isSelected }: { isSelected: (s: string) => boolean }) => {
    const searchParams = useSearchParams();

    return (
        <List component="div" disablePadding>
            <Link className="no-underline" href={{ pathname: '/dashboard', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard')}>
                        <ListItemIcon className="ml-4">
                            <HighlightIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Overblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/driving', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/driving')}>
                        <ListItemIcon className="ml-4">
                            <DateRangeIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Kørsel" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/activity', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/activity')}>
                        <ListItemIcon className="ml-4">
                            <TableChartIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Køretøjsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/timeactivity', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/timeactivity')}>
                        <ListItemIcon className="ml-4">
                            <TableChartOutlinedIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Tidsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/trip-segments', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/trip-segments')}>
                        <ListItemIcon className="ml-4">
                            <TroubleshootIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Turoverblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/availability', query: searchParams.toString() }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/availability')}>
                        <ListItemIcon className="ml-4">
                            <TimelineIcon/>
                        </ListItemIcon>
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
                    <ListItemButton selected={isSelected('/dashboard')}>
                        <ListItemIcon className="ml-4">
                            <HighlightIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Overblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/driving' }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/driving')}>
                        <ListItemIcon className="ml-4">
                            <DateRangeIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Kørsel" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/activity' }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/activity')}>
                        <ListItemIcon className="ml-4">
                            <TableChartIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Køretøjsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/timeactivity' }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/timeactivity')}>
                        <ListItemIcon className="ml-4">
                            <TableChartOutlinedIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Tidsaktivitet" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/trip-segments' }}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/trip-segments')}>
                        <ListItemIcon className="ml-4">
                            <TroubleshootIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Turoverblik" />
                    </ListItemButton>
                </ListItem>
            </Link>
            <Link className="no-underline" href={{ pathname: '/dashboard/availability'}}>
                <ListItem disablePadding>
                    <ListItemButton selected={isSelected('/dashboard/availability')}>
                        <ListItemIcon className="ml-4">
                            <TimelineIcon/>
                        </ListItemIcon>
                        <ListItemText className="text-black" primary="Ledighed" />
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
