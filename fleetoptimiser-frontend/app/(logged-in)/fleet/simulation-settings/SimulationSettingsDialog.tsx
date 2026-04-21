import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Divider,
    IconButton,
    ListItemButton,
    ListItemText,
    Paper,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import { ReactNode, useState } from 'react';
import OptimisationSettings from '@/app/(logged-in)/goal/optimisationSettings';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { setIntelligentAllocation, setLimitKm } from '@/components/redux/SimulationSlice';
import { brand, gray, green } from '@/theme/themePrimitives';
import { ShiftsPage } from './ShiftsPage';
import { GeneralPage } from './GeneralPage';
import { BikePage } from './BikePage';
type SettingsPage = 'main' | 'shifts' | 'general' | 'bike';

const pageTitles: Record<SettingsPage, string> = {
    main: '',
    shifts: 'Vagtlagsindstillinger',
    general: 'Generelle indstillinger',
    bike: 'Cykelegenskaber',
};

const iconBoxBase = {
    width: 36,
    height: 36,
    borderRadius: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

const SectionLabel = ({ children }: { children: string }) => (
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.3, mb: 1, display: 'block', px: 0.5 }}>
        {children}
    </Typography>
);

const ToggleRow = ({ title, description, tooltipText, checked, disabled, onChange }: {
    title: string; description: string; tooltipText: string;
    checked: boolean; disabled: boolean; onChange: () => void;
}) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 2 }}>
        <Box sx={{ mr: 2 }}>
            <Typography variant="subtitle2" color="text.primary">{title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                {description}
            </Typography>
        </Box>
        <Tooltip title={tooltipText} placement="top" arrow>
            <Switch disabled={disabled} onChange={onChange} checked={checked} color="primary" />
        </Tooltip>
    </Box>
);

const NavItem = ({ icon, bgColor, fgColor, primary, secondary, onClick }: {
    icon: ReactNode; bgColor: string; fgColor: string;
    primary: string; secondary: string; onClick: () => void;
}) => (
    <ListItemButton onClick={onClick} sx={{ px: 2.5, py: 1.5 }}>
        <Box sx={{ ...iconBoxBase, bgcolor: bgColor, color: fgColor }}>{icon}</Box>
        <ListItemText primary={primary} secondary={secondary} sx={{ ml: 2 }} />
        <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
    </ListItemButton>
);

export const SimulationSettingsWidget = ({ manualSimulation }: { manualSimulation: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState<SettingsPage>('main');
    const dispatch = useAppDispatch();

    const name = `${manualSimulation ? 'Simulerings' : 'Optimerings'}indstillinger`;
    const optimalAllocation = useAppSelector((state) => state.simulation.intelligent_allocation);
    const limitKm = useAppSelector((state) => state.simulation.limit_km);

    const handleClose = () => {
        setIsOpen(false);
        setCurrentPage('main');
    };

    return (
        <div>
            <Button
                onClick={() => setIsOpen(true)}
                variant="outlined"
                color="inherit"
                startIcon={<SettingsOutlinedIcon />}
                size="small"
            >
                {name}
            </Button>

            <Dialog
                open={isOpen}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fcfcfc' }}>
                    <div className="flex items-center gap-1">
                        {currentPage !== 'main' && (
                            <IconButton onClick={() => setCurrentPage('main')} size="small" aria-label="tilbage">
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                        )}
                        <Typography variant="h6" component="span">
                            {currentPage === 'main' ? name : pageTitles[currentPage]}
                        </Typography>
                    </div>
                    <IconButton onClick={handleClose} size="small" aria-label="luk">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ bgcolor: '#fcfcfc', px: 3, pb: 3, pt: 3 }}>
                    {currentPage === 'main' && (
                        <div className="space-y-5">
                            {!manualSimulation && (
                                <div>
                                    <SectionLabel>Optimering</SectionLabel>
                                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                        <OptimisationSettings />
                                    </Paper>
                                </div>
                            )}

                            <div>
                                <SectionLabel>Simulering</SectionLabel>
                                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                    <ToggleRow
                                        title="Optimal tildeling"
                                        description="Aktiver optimal tildeling af køretøjer til rundeture for bedre udnyttelse af din flåde."
                                        tooltipText="Anvend intelligent allokering. Vær opmærksom på, at denne type simulering tager væsentlig længere tid. Intelligent allokering bygger på en algoritme der er optimeret til at håndtere 'enkelt-dags-ture', så hvis denne lokation har lange kørsler anbefales denne funktionalitet ikke."
                                        checked={optimalAllocation}
                                        disabled={limitKm}
                                        onChange={() => dispatch(setIntelligentAllocation(!optimalAllocation))}
                                    />
                                    <Divider />
                                    <ToggleRow
                                        title="Begræns km/år"
                                        description="Aktiver begrænsning af km for at overholde tilladte km-antal på leasingkontrakten."
                                        tooltipText="Vil du anvende begrænsning af kilometer på dine køretøjer ift. antallet af kilometer på leasingaftalen, skal du benytte denne funktionalitet. Kan ikke benyttes sammen med intelligent allokering."
                                        checked={limitKm}
                                        disabled={optimalAllocation}
                                        onChange={() => dispatch(setLimitKm(!limitKm))}
                                    />
                                </Paper>
                            </div>

                            <div>
                                <SectionLabel>Konfiguration</SectionLabel>
                                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                    <NavItem
                                        icon={<AccessTimeIcon fontSize="small" />}
                                        bgColor={brand[50]} fgColor={brand[400]}
                                        primary="Vagtlag"
                                        secondary="Angiv vagtlag for lokationerne"
                                        onClick={() => setCurrentPage('shifts')}
                                    />
                                    <Divider />
                                    <NavItem
                                        icon={<SettingsIcon fontSize="small" />}
                                        bgColor={gray[100]} fgColor={gray[600]}
                                        primary="Generelt"
                                        secondary="Drivmiddelpriser, udledning og øvrige parametre"
                                        onClick={() => setCurrentPage('general')}
                                    />
                                    <Divider />
                                    <NavItem
                                        icon={<DirectionsBikeIcon fontSize="small" />}
                                        bgColor={green[50]} fgColor={green[400]}
                                        primary="Cykel"
                                        secondary="Konfigurer cykelegenskaber"
                                        onClick={() => setCurrentPage('bike')}
                                    />
                                </Paper>
                            </div>
                        </div>
                    )}

                    {currentPage === 'shifts' && <ShiftsPage />}
                    {currentPage === 'general' && <GeneralPage />}
                    {currentPage === 'bike' && <BikePage />}
                </DialogContent>
            </Dialog>
        </div>
    );
};
