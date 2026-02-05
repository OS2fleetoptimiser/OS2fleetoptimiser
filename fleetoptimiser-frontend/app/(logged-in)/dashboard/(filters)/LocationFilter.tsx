import { Button, Checkbox, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, TextField } from '@mui/material';
import { useState } from 'react';
import { Search } from '@mui/icons-material';
import {locationInput} from "@/app/(logged-in)/dashboard/(filters)/FilterHeader";

export type props = {
    selectedLocations: number[];
    setSelectedLocations: (locations: number[]) => void;
    selectedVehicles?: number[];
    setVehicles: (vehicles: number[]) => void;
    selectedDepartments?: string[];
    setDepartments?: (departments: string[]) => void;
    selectedForvaltninger?: string[];
    setSelectedForvaltninger?: (forvaltninger: string[]) => void;
};

type newProps = {
    setSelectedLocations: (locations: locationInput[]) => void;
    selectableLocations?: locationInput[];
    selectedLocations: number[];
}

export default function LocationFilter({
    setSelectedLocations,
    selectableLocations,
    selectedLocations,
}: newProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div>
            <Button onClick={handleClick}>Lokationer ({selectedLocations.length})</Button>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
            >
                <div className="p-2">
                    <div className="flex gap-2 mb-4">
                        <TextField
                            size="small"
                            type="text"
                            placeholder="Søg..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <IconButton>
                                                <Search />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                        />
                        <Button
                            className="w-40"
                            variant="outlined"
                            onClick={() => {
                                if (selectableLocations) {
                                    if (selectedLocations.length < selectableLocations.length) {
                                        setSelectedLocations(selectableLocations);
                                    } else {
                                        setSelectedLocations([]);
                                    }
                                }
                            }}
                        >
                            {selectableLocations && selectedLocations.length < selectableLocations.length ? 'Vælg Alle' : 'Fravælg Alle'}
                        </Button>
                    </div>
                    <List>
                        {selectableLocations && (() => {
                            const selectableLocationKeys = selectableLocations.map(loc => loc.key);
                            return selectedLocations.some(selectedLoc => !selectableLocationKeys.includes(selectedLoc));
                          })() &&
                          <p className="text-explanation text-xs">Frigør andre filtre for at se alle valgte lokationer</p>
                        }
                        {selectableLocations?.length === 0 && <p>Der er ingen tilgængelige lokationer</p>}
                        {
                            selectableLocations && selectableLocations?.length > 0 &&
                            selectableLocations?.filter((loc) => loc.value.toLowerCase().includes(searchQuery.toLowerCase()))
                            .sort((a, b) => a.value.localeCompare(b.value))
                            .map((loc) => (
                            <ListItem key={loc.key} disablePadding>
                                <ListItemButton
                                    role={undefined}
                                    onClick={() => {
                                        const selectedKey = loc.key;
                                        const isAlreadySelected = selectedLocations.includes(selectedKey);
                                        const updatedSelectedLocations = isAlreadySelected
                                            ? selectableLocations?.filter((location) => selectedLocations.includes(location.key) && location.key !== selectedKey)
                                            : selectableLocations?.filter((location) => selectedLocations.includes(location.key) || location.key === selectedKey);
                                        setSelectedLocations(updatedSelectedLocations);
                                        }}
                                    dense>
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={!!selectedLocations.find((id) => id === loc.key)}
                                            tabIndex={-1}
                                            disableRipple
                                        />
                                    </ListItemIcon>
                                    <ListItemText primary={loc.value} />
                                </ListItemButton>
                            </ListItem>
                            ))
                        }
                    </List>
                </div>
            </Menu>
        </div>
    );
}
