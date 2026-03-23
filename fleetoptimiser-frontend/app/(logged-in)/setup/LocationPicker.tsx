import { useState, useMemo, useEffect } from 'react'
import {
    Box,
    Dialog,
    Button,
    TextField,
    IconButton,
    InputAdornment,
    Typography,
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import PlaceIcon from '@mui/icons-material/Place'

import { setLocationAddresses } from '@/components/redux/SimulationSlice'
import { useAppDispatch } from '@/components/redux/hooks'

interface Location {
    id: number
    address: string
}

interface Forvaltninger {
    [forvaltningId: string]: number[]
}

export interface SelectedLocation {
    id: number
    forvaltning: string
}

interface Props {
    locations: Location[]
    forvaltninger?: Forvaltninger
    onSelectionChange: (items: SelectedLocation[]) => void
    preSelectedLocations: SelectedLocation[]
}

function isLocationSelected(selections: SelectedLocation[], id: number, forvaltning: string) {
    return selections.some((sel) => sel.id === id && sel.forvaltning === forvaltning)
}

function ForvaltningItem({
    name,
    isActive,
    locationCount,
    selectedCount,
    onClick,
}: {
    name: string
    isActive: boolean
    locationCount: number
    selectedCount: number
    onClick: () => void
}) {
    return (
        <Box onClick={onClick} sx={{ cursor: 'pointer', display: 'flex', gap: 0.75 }}>
            <Box
                sx={{
                    width: 3,
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: isActive ? 'primary.main' : 'transparent',
                    transition: 'background-color 0.15s ease',
                }}
            />
            <Box
                sx={{
                    flex: 1,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    bgcolor: isActive ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: isActive ? 'action.selected' : 'action.hover' },
                    transition: 'background-color 0.15s ease',
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="min-w-0">
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: isActive ? 600 : 400, lineHeight: 1.4 }}
                            color="text.primary"
                            noWrap
                        >
                            {name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                            {locationCount} adresser
                        </Typography>
                    </div>
                    {selectedCount > 0 && (
                        <Box
                            sx={{
                                bgcolor: 'action.selected',
                                borderRadius: '10px',
                                minWidth: 20,
                                height: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                px: 0.75,
                                ml: 1,
                                flexShrink: 0,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600, lineHeight: 1 }}>
                                {selectedCount}
                            </Typography>
                        </Box>
                    )}
                </div>
            </Box>
        </Box>
    )
}

function LocationRow({
    address,
    selected,
    onClick,
}: {
    address: string
    selected: boolean
    onClick: () => void
}) {
    return (
        <Box
            onClick={onClick}
            sx={{
                px: 2,
                py: 1,
                cursor: 'pointer',
                bgcolor: selected ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'background-color 0.1s ease',
            }}
        >
            <Box
                sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'primary.main' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                }}
            >
                {selected && <CheckIcon sx={{ fontSize: 14, color: 'white' }} />}
            </Box>
            <Typography variant="body2" color={selected ? 'text.primary' : 'text.secondary'}>
                {address}
            </Typography>
        </Box>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <PlaceIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
            <Typography variant="body2" color="text.secondary">
                Ingen lokationer fundet
            </Typography>
        </div>
    )
}

export default function LocationPicker({ preSelectedLocations, locations, forvaltninger, onSelectionChange }: Props) {
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    // Local draft -- only committed to parent on "Bekræft"
    const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>(preSelectedLocations)
    const [activeForvaltning, setActiveForvaltning] = useState<string | null>(null)
    const dispatch = useAppDispatch()

    // Sync location addresses to Redux for use outside this component
    useEffect(() => {
        dispatch(setLocationAddresses(locations || []))
    }, [dispatch, locations])

    const locationsByForvaltning = useMemo(() => {
        const grouped: { [key: string]: Location[] } = {}
        if (forvaltninger && Object.keys(forvaltninger).length > 0) {
            Object.entries(forvaltninger).forEach(([name, ids]) => {
                grouped[name] = locations.filter((loc) => ids.includes(loc.id))
            })
        } else {
            grouped['Alle lokationer'] = locations
        }
        return grouped
    }, [locations, forvaltninger])

    const sortedForvaltningNames = useMemo(() => {
        return Object.keys(locationsByForvaltning).sort((a, b) => {
            if (a === 'Alle lokationer' || a === 'Ingen Forvaltning') return 1
            if (b === 'Alle lokationer' || b === 'Ingen Forvaltning') return -1
            return a.localeCompare(b)
        })
    }, [locationsByForvaltning])

    const hasMultipleForvaltninger = sortedForvaltningNames.length > 1

    const visibleForvaltninger = useMemo(() => {
        const query = searchQuery.toLowerCase()
        return sortedForvaltningNames.filter((name) => {
            if (name.toLowerCase().includes(query)) return true
            return (locationsByForvaltning[name] ?? []).some((loc) =>
                loc.address.toLowerCase().includes(query)
            )
        })
    }, [sortedForvaltningNames, locationsByForvaltning, searchQuery])

    const currentLocs = useMemo(() => {
        if (!activeForvaltning) return []
        const query = searchQuery.toLowerCase()
        return (locationsByForvaltning[activeForvaltning] ?? [])
            .filter((loc) => loc.address.toLowerCase().includes(query))
            .sort((a, b) => a.address.localeCompare(b.address))
    }, [activeForvaltning, searchQuery, locationsByForvaltning])

    const currentAllSelected = activeForvaltning
        ? (locationsByForvaltning[activeForvaltning] ?? []).every((l) =>
            isLocationSelected(selectedLocations, l.id, activeForvaltning)
        )
        : false

    const triggerLabel = preSelectedLocations.length === 0
        ? 'Vælg lokationer...'
        : `${preSelectedLocations.length} lokation${preSelectedLocations.length === 1 ? '' : 'er'} valgt`


    useEffect(() => {
        if (open && sortedForvaltningNames.length > 0 && !activeForvaltning) {
            setActiveForvaltning(sortedForvaltningNames[0])
        }
    }, [open, sortedForvaltningNames, activeForvaltning])

    const toggleLocation = (id: number, forvaltning: string) => {
        if (isLocationSelected(selectedLocations, id, forvaltning)) {
            setSelectedLocations(selectedLocations.filter((sel) => !(sel.id === id && sel.forvaltning === forvaltning)))
        } else {
            setSelectedLocations([...selectedLocations, { id, forvaltning }])
        }
    }

    const toggleAllInForvaltning = (forvaltning: string) => {
        const locs = locationsByForvaltning[forvaltning]
        const allSelected = locs.every((l) => isLocationSelected(selectedLocations, l.id, forvaltning))
        if (allSelected) {
            setSelectedLocations(selectedLocations.filter((sel) => sel.forvaltning !== forvaltning))
        } else {
            const toAdd = locs
                .filter((l) => !isLocationSelected(selectedLocations, l.id, forvaltning))
                .map((l) => ({ id: l.id, forvaltning }))
            setSelectedLocations([...selectedLocations, ...toAdd])
        }
    }

    const deselectAll = () => setSelectedLocations([])

    const handleOpen = () => {
        setSelectedLocations(preSelectedLocations)
        setActiveForvaltning(sortedForvaltningNames[0] ?? null)
        setOpen(true)
    }

    const handleClose = () => {
        setSelectedLocations(preSelectedLocations)
        setSearchQuery('')
        setOpen(false)
    }

    const handleConfirm = () => {
        onSelectionChange(selectedLocations)
        setSearchQuery('')
        setOpen(false)
    }

    return (
        <>
            <div>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <PlaceIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    Lokation
                </Typography>
                <Box
                    className="rounded-lg py-2 px-4 cursor-pointer flex items-center justify-between"
                    sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
                    onClick={handleOpen}
                >
                    <Typography
                        variant="body2"
                        color={preSelectedLocations.length === 0 ? 'text.secondary' : 'text.primary'}
                        noWrap
                    >
                        {triggerLabel}
                    </Typography>
                    <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.secondary', ml: 0.5, flexShrink: 0 }} />
                </Box>
            </div>

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth={hasMultipleForvaltninger ? 'md' : 'sm'}
                slotProps={{ paper: { sx: { borderRadius: 3, height: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } } }}
            >
                <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                    <div className="flex items-center justify-between mb-2">
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Vælg lokationer
                        </Typography>
                        <IconButton size="small" onClick={handleClose}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </div>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Søg lokationer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: searchQuery ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchQuery('')}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                    />
                </Box>

                <div className="flex flex-1 overflow-hidden min-h-0">
                    {hasMultipleForvaltninger && (
                        <Box
                            sx={{ borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}
                            className="w-56 flex-shrink-0 overflow-auto flex flex-col"
                        >
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ px: 2, pt: 2, pb: 1, fontWeight: 600, display: 'block' }}
                            >
                                Forvaltning
                            </Typography>
                            <div className="flex-1 overflow-auto px-1.5 pb-1.5 space-y-1">
                                {visibleForvaltninger.map((name) => (
                                    <ForvaltningItem
                                        key={name}
                                        name={name}
                                        isActive={activeForvaltning === name}
                                        locationCount={locationsByForvaltning[name]?.length ?? 0}
                                        selectedCount={selectedLocations.filter((sel) => sel.forvaltning === name).length}
                                        onClick={() => setActiveForvaltning(name)}
                                    />
                                ))}
                            </div>
                        </Box>
                    )}

                    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                        {activeForvaltning && (
                            <Box
                                sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                                className="flex items-center justify-between flex-shrink-0"
                            >
                                <div>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary">
                                        {activeForvaltning}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {currentLocs.length} adresser
                                    </Typography>
                                </div>
                                <Button
                                    size="small"
                                    onClick={() => activeForvaltning && toggleAllInForvaltning(activeForvaltning)}
                                    sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 0, px: 1 }}
                                >
                                    {currentAllSelected ? 'Fravælg alle' : 'Vælg alle'}
                                </Button>
                            </Box>
                        )}

                        <div className="flex-1 overflow-auto">
                            {currentLocs.length === 0 && activeForvaltning && <EmptyState />}
                            {activeForvaltning && currentLocs.map((location) => (
                                <LocationRow
                                    key={`${activeForvaltning}-${location.id}`}
                                    address={location.address}
                                    selected={isLocationSelected(selectedLocations, location.id, activeForvaltning)}
                                    onClick={() => toggleLocation(location.id, activeForvaltning)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <Box
                    sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}
                    className="flex items-center justify-between"
                >
                    <div className="flex items-center gap-2">
                        <Typography variant="body2" color="text.secondary">
                            {selectedLocations.length === 0
                                ? 'Ingen valgt'
                                : `${selectedLocations.length} lokation${selectedLocations.length === 1 ? '' : 'er'} valgt`}
                        </Typography>
                        {selectedLocations.length > 0 && (
                            <Button
                                size="small"
                                color="inherit"
                                onClick={deselectAll}
                                sx={{ textTransform: 'none', fontSize: '0.8125rem', minWidth: 0 }}
                            >
                                Ryd
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleClose} variant="outlined" size="small">
                            Annuller
                        </Button>
                        <Button onClick={handleConfirm} variant="contained" size="small">
                            Bekræft ({selectedLocations.length})
                        </Button>
                    </div>
                </Box>
            </Dialog>
        </>
    )
}
