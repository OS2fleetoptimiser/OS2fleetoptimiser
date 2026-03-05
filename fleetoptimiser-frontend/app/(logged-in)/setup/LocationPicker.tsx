import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Checkbox,
    TextField,
    Chip,
    FormGroup,
    FormControlLabel,
    Collapse,
    IconButton,
    InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import { BpIcon, BpCheckedIcon } from './CheckBoxIcons';
import { setLocationAddresses } from '@/components/redux/SimulationSlice';
import { useAppDispatch } from '@/components/redux/hooks';

interface Location {
    id: number;
    address: string;
}

interface Forvaltninger {
    [forvaltningId: string]: number[];
}

export interface SelectedLocation {
    id: number;
    forvaltning: string;
}

interface Props {
    locations: Location[];
    forvaltninger?: Forvaltninger;
    onSelectionChange: (items: SelectedLocation[]) => void;
    preSelectedLocations: SelectedLocation[];
}

export default function LocationPicker({ preSelectedLocations, locations, forvaltninger, onSelectionChange }: Props) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedForvaltninger, setExpandedForvaltninger] = useState<string[]>([]);
    const [selectedForvaltninger, setSelectedForvaltninger] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>(preSelectedLocations); // local state that updates global when "Bekræft" is clicked
    const dispatch = useAppDispatch();
    useEffect(() => {
        // to avoid pre-rendering global update state
        dispatch(setLocationAddresses(locations || []));
    }, [dispatch, locations]);

    const locationsByForvaltning = useMemo(() => {
        const grouped: { [key: string]: Location[] } = {};
        if (forvaltninger && Object.keys(forvaltninger).length > 0) {
            Object.entries(forvaltninger).forEach(([name, ids]) => {
                grouped[name] = locations.filter((loc) => ids.includes(loc.id));
            });
        } else {
            grouped['Ingen Forvaltning'] = locations;
        }
        return grouped;
    }, [locations, forvaltninger]);

    const filteredForvaltninger = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return Object.entries(locationsByForvaltning).filter(([name, locs]) => {
            return name.toLowerCase().includes(query) || locs.some((loc) => loc.address.toLowerCase().includes(query));
        });
    }, [locationsByForvaltning, searchQuery]);

    const getFilteredLocations = (forvaltning: string) => {
        const query = searchQuery.toLowerCase();
        return locationsByForvaltning[forvaltning]
            .filter((loc) => loc.address.toLowerCase().includes(query))
            .sort((a, b) => a.address.localeCompare(b.address));
    };

    const toggleLocationSelection = (id: number, forvaltning: string) => {
        const exists = selectedLocations.some((sel) => sel.id === id && sel.forvaltning === forvaltning);
        if (exists) {
            setSelectedLocations(selectedLocations.filter((sel) => !(sel.id === id && sel.forvaltning === forvaltning)));
        } else {
            setSelectedLocations([...selectedLocations, { id, forvaltning }]);
        }
    };

    const toggleAllLocationsOfForvaltning = (forvaltning: string) => {
        const locs = locationsByForvaltning[forvaltning];
        const allSelected = locs.every((l) => selectedLocations.some((sel) => sel.id === l.id && sel.forvaltning === forvaltning));

        if (allSelected) {
            setSelectedLocations(selectedLocations.filter((sel) => sel.forvaltning !== forvaltning));
        } else {
            const toAdd = locs
                .filter((l) => !selectedLocations.some((sel) => sel.id === l.id && sel.forvaltning === forvaltning))
                .map((l) => ({ id: l.id, forvaltning }));
            setSelectedLocations([...selectedLocations, ...toAdd]);
        }
    };

    const deselectAll = () => setSelectedLocations([]);

    const toggleExpand = (name: string) => {
        setExpandedForvaltninger((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
    };

    const toggleForvaltningFilter = (name: string) => {
        setSelectedForvaltninger((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
    };

    const shouldShowForvaltning = (name: string) => {
        return selectedForvaltninger.length === 0 || selectedForvaltninger.includes(name);
    };

    const handleClose = () => {
        setSelectedLocations(preSelectedLocations);
        setOpen(false);
    };

    const handleOk = () => {
        onSelectionChange(selectedLocations);
        setOpen(false);
    };

    return (
        <>
            <div className="w-64 bg-white">
                <label className="text-lg font-semibold text-black">Vælg lokationer</label>
                <div className="mt-2 border rounded-md py-2 px-4 cursor-pointer" onClick={() => setOpen(true)}>
                    <label className="block text-sm font-medium text-gray-700 cursor-pointer">Vælg lokationer...</label>
                </div>
                <div className="mt-4 mb-20 relative overflow-visible">
                    <div className="absolute left-0 whitespace-nowrap space-x-1 w-[64px] sm:w-full">
                        {selectedLocations.length === 0 || selectedLocations.length > 3 ? (
                            <Tooltip
                                title={
                                    <div>
                                        {selectedLocations.map((sel, i) => {
                                            const loc = locations.find((l) => l.id === sel.id);
                                            if (!loc) return null;
                                            return (
                                                <div key={`${sel.forvaltning}-${sel.id}-${i}`}>
                                                    {sel.forvaltning}: {loc.address}
                                                </div>
                                            );
                                        })}
                                    </div>
                                }
                            >
                                <Chip
                                    onClick={() => setOpen(true)}
                                    key="locationSelectedMain"
                                    label={`${selectedLocations.length} lokationer valgt`}
                                    color="default"
                                    disabled={selectedLocations.length === 0}
                                />
                            </Tooltip>
                        ) : (
                            selectedLocations.map((location) => {
                                const loc = locations.find((l) => l.id === location.id);
                                const fullLabel = loc ? `${location.forvaltning}: ${loc.address}` : '';
                                const truncatedLabel = fullLabel.length > 20 ? fullLabel.slice(0, 20) + '...' : fullLabel;
                                return (
                                    <Tooltip key={`tooltip-${location.id}`} title={fullLabel}>
                                        <Chip
                                            onClick={() => setOpen(true)}
                                            key={`locationSelected${location.id}`}
                                            label={truncatedLabel}
                                            color="default"
                                            disabled={selectedLocations.length === 0}
                                        />
                                    </Tooltip>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
            <Dialog open={open} fullWidth maxWidth="md">
                <DialogTitle>Vælg lokationer</DialogTitle>
                <DialogContent className="h-[800px] flex flex-col">
                    <div className="absolute top-4 right-4 cursor-pointer">
                        <CloseIcon onClick={handleClose} fontSize="small" className="text-gray-500 hover:text-black" />
                    </div>
                    <TextField
                        fullWidth
                        className="my-1 bg-[#F5F5F5] rounded-md px-1"
                        variant="standard"
                        placeholder="Søg i lokationer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        slotProps={{
                            input: {
                                disableUnderline: true,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchQuery && (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setSearchQuery('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                                sx: {
                                    height: 36,
                                    fontSize: 14,
                                    paddingX: 1,
                                },
                            },

                            htmlInput: {
                                style: {
                                    padding: 0,
                                    fontSize: 14,
                                },
                            }
                        }} />
                    <div className="flex mb-2 space-y-1">
                        <span className="self-center text-sm text-gray-500 mr-2">Valgte Lokationer:</span>
                        <Tooltip
                            title={
                                <div>
                                    {selectedLocations.map((sel, i) => {
                                        const loc = locations.find((l) => l.id === sel.id);
                                        if (!loc) return null;
                                        return (
                                            <div key={`${sel.forvaltning}-${sel.id}-${i}`}>
                                                {sel.forvaltning}: {loc.address}
                                            </div>
                                        );
                                    })}
                                </div>
                            }
                        >
                            <Chip
                                key="locationSelected"
                                label={`${selectedLocations.length} lokation${selectedLocations.length === 1 ? '' : 'er'}`}
                                color={selectedLocations.length === 0 ? 'default' : 'primary'}
                                onDelete={deselectAll}
                                disabled={selectedLocations.length === 0}
                            />
                        </Tooltip>
                    </div>

                    <div className="flex space-x-1 mb-2 flex-wrap">
                        <span className="self-center text-sm text-gray-500 mr-2">Forvaltninger:</span>
                        {Object.keys(locationsByForvaltning)
                            .sort((a, b) => {
                                if (a === 'Ingen Forvaltning') return 1;
                                if (b === 'Ingen Forvaltning') return -1;
                                return a.localeCompare(b);
                            })
                            .map((name) => (
                                <Chip
                                    key={name}
                                    label={name}
                                    clickable
                                    color={selectedForvaltninger.includes(name) ? 'primary' : 'default'}
                                    onClick={() => toggleForvaltningFilter(name)}
                                />
                            ))}
                    </div>

                    <div className="overflow-auto border-[#eee] border rounded-md p-2">
                        {filteredForvaltninger
                            .sort((a, b) => {
                                if (a[0] === 'Ingen Forvaltning') return 1;
                                if (b[0] === 'Ingen Forvaltning') return -1;
                                return a[0].localeCompare(b[0]);
                            })
                            .map(([forvaltning]) => {
                                const filteredLocs = getFilteredLocations(forvaltning);
                                if (!shouldShowForvaltning(forvaltning) || filteredLocs.length === 0) return null;
                                const isExpanded = expandedForvaltninger.includes(forvaltning);
                                const allSelected = filteredLocs.every((l) =>
                                    selectedLocations.some((sel) => sel.id === l.id && sel.forvaltning === forvaltning)
                                );
                                const selectedLocationsInForvaltning = selectedLocations.filter((loc) => loc.forvaltning === forvaltning).length;
                                return (
                                    <div className="mb-2" key={forvaltning}>
                                        <div
                                            onClick={() => toggleExpand(forvaltning)}
                                            className="flex items-center justify-between bg-gray-100 cursor-pointer rounded-md pr-2 pl-6"
                                        >
                                            <FormControlLabel
                                                className="cursor-pointer"
                                                control={
                                                    <Checkbox
                                                        disabled
                                                        className="hidden"
                                                        checked={allSelected}
                                                        onChange={() => toggleAllLocationsOfForvaltning(forvaltning)}
                                                    />
                                                }
                                                label={
                                                    <span className="text-gray-700 font-semibold text-md">
                                                        {forvaltning}
                                                        <span className="ml-3 text-gray-500 text-xs">({filteredLocs.length} lokationer)</span>
                                                        <span className="ml-3 text-gray-500 text-xs">
                                                            {selectedLocationsInForvaltning === 0 ? '' : `(${selectedLocationsInForvaltning} valgt)`}
                                                        </span>
                                                    </span>
                                                }
                                            />
                                            <IconButton onClick={() => toggleExpand(forvaltning)}>
                                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                            </IconButton>
                                        </div>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <FormGroup className="pl-6">
                                                {filteredLocs.map((location) => (
                                                    <FormControlLabel
                                                        key={`${forvaltning}-${location.id}`}
                                                        control={
                                                            <Checkbox
                                                                sx={{ '&:hover': { bgcolor: 'transparent' } }}
                                                                checkedIcon={<BpCheckedIcon />}
                                                                icon={<BpIcon />}
                                                                checked={selectedLocations.some(
                                                                    (sel) => sel.id === location.id && sel.forvaltning === forvaltning
                                                                )}
                                                                onChange={() => toggleLocationSelection(location.id, forvaltning)}
                                                            />
                                                        }
                                                        label={
                                                            <div>
                                                                <span className="text-sm font-medium self-baseline text-gray-600">{location.address}</span>
                                                            </div>
                                                        }
                                                    />
                                                ))}
                                            </FormGroup>
                                        </Collapse>
                                    </div>
                                );
                            })}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} variant="outlined">
                        LUK
                    </Button>
                    <Button onClick={handleOk} variant="contained">
                        Bekræft
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
