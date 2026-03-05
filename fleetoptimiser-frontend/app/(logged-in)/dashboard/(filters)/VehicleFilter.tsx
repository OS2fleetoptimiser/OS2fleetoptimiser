import { Button, Checkbox, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, TextField } from '@mui/material';
import { useState } from 'react';
import { Search } from '@mui/icons-material';
import {Vehicle} from '@/components/hooks/useGetVehicles';

export type props = {
    selectedLocations: number[];
    setSelectedLocations: (locations: number[]) => void;
    selectedVehicles: number[];
    setVehicles: (vehicles: number[]) => void;
    selectedDepartments?: string[];
    setDepartments?: (departments: string[]) => void;
    selectedForvaltninger?: string[];
    setSelectedForvaltninger?: (forvaltninger: string[]) => void;
};


type newProps = {
    setSelectedVehicles: (vehicles: Vehicle[]) => void;
    selectedVehicles: number[];
    selectableVehicles?: Vehicle[];
}


export default function VehicleFilter({
    setSelectedVehicles,
    selectedVehicles,
    selectableVehicles,
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
            <Button onClick={handleClick}>Køretøjer ({selectedVehicles.length})</Button>
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
                                if (selectableVehicles) {
                                    if (selectableVehicles && selectedVehicles.length < selectableVehicles.length) {
                                        setSelectedVehicles(selectableVehicles);
                                    } else {
                                        setSelectedVehicles([]);
                                    }
                                }
                            }}
                        >
                            {selectableVehicles && selectedVehicles.length < selectableVehicles.length ? 'Vælg Alle' : 'Fravælg Alle'}
                        </Button>
                    </div>
                    <List>
                        {selectableVehicles && (() => {
                            const selectableVehiclesKeys = selectableVehicles.map(vehicle => vehicle.id);
                            return selectedVehicles.some(selectedVeh => !selectableVehiclesKeys.includes(selectedVeh));
                          })() &&
                          <ListItem className="text-explanation text-xs">Frigør andre filtre for at se alle valgte køretøjer</ListItem>
                        }
                        {selectableVehicles && selectableVehicles.length === 0 && <ListItem>Der er ingen tilgængelige Køretøjer</ListItem>}
                        {selectableVehicles && selectableVehicles
                            .filter((vehicle) => vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((vehicle) => (
                                <ListItem key={vehicle.id} disablePadding>
                                    <ListItemButton role={undefined} onClick={() => {
                                        const isAlreadySelected = selectedVehicles.includes(vehicle.id)
                                        const updateSelectedVehicles = isAlreadySelected
                                            ? selectableVehicles?.filter((veh) => selectedVehicles.includes(veh.id) && vehicle.id !== veh.id)
                                            : selectableVehicles?.filter((veh) => selectedVehicles.includes(veh.id) || vehicle.id === veh.id)
                                        setSelectedVehicles(updateSelectedVehicles)
                                        }
                                    } dense>
                                        <ListItemIcon>
                                            <Checkbox edge="start" checked={!!selectedVehicles.find((id) => id === vehicle.id)} tabIndex={-1} disableRipple />
                                        </ListItemIcon>
                                        <ListItemText primary={vehicle.name} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                    </List>
                </div>
            </Menu>
        </div>
    );
}
