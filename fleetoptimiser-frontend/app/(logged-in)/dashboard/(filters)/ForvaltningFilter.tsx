import { Button, Checkbox, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, TextField } from '@mui/material';
import { useState } from 'react';
import { Search } from '@mui/icons-material';
import useGetVehicles, { Vehicle } from '@/components/hooks/useGetVehicles';

type props = {
    selectedForvaltninger: string[];
    setSelectedForvaltninger: (forvaltninger: string[]) => void;
    selectedLocations: number[];
    setSelectedLocations: (locations: number[]) => void;
    selectedVehicles?: number[];
    setVehicles?: (vehicles: number[]) => void;
    selectedDepartments?: string[];
    setDepartments?: (departments: string[]) => void;
};

type newProps = {
    setSelectedForvaltninger: (forvaltninger: string[]) => void;
    selectedForvaltninger: string[];
    selectableForvaltninger?: string[];
}

export default function ForvaltningFilter({
    setSelectedForvaltninger,
    selectedForvaltninger,
    selectableForvaltninger
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
            <Button onClick={handleClick}>Forvaltninger ({selectedForvaltninger.length})</Button>
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
                            fullWidth
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
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                if (selectableForvaltninger && selectedForvaltninger.length < selectableForvaltninger.length) {
                                    setSelectedForvaltninger(selectableForvaltninger);
                                } else {
                                    setSelectedForvaltninger([]);
                                }
                            }}
                        >
                            {selectableForvaltninger && selectedForvaltninger.length < selectableForvaltninger.length ? 'Vælg Alle' : 'Fravælg Alle'}
                        </Button>
                    </div>
                    <List>
                        {selectableForvaltninger && selectedForvaltninger.some(selFor => !selectableForvaltninger.includes(selFor)) &&
                          <p className="text-explanation text-xs">Frigør andre filtre for at se alle valgte forvaltninger</p>
                        }
                        {selectableForvaltninger && selectableForvaltninger.length === 0 && <p>Der er ingen tilgængelige forvaltninger</p>}
                        {selectableForvaltninger &&
                            selectableForvaltninger.length > 0 &&
                            selectableForvaltninger.map((dep) => (
                                (<ListItem key={dep} disablePadding>
                                    <ListItemButton
                                        role={undefined}
                                        onClick={() => {
                                            const isAlreadySelected = !!selectedForvaltninger.find((depName) => depName === dep);
                                            const updatedForvaltninger = isAlreadySelected
                                                ? selectedForvaltninger.filter((depName) => depName !== dep)
                                                : [...selectedForvaltninger, dep];
                                            setSelectedForvaltninger(updatedForvaltninger);
                                            }
                                        }
                                        dense>
                                        <ListItemIcon>
                                            <Checkbox
                                                edge="start"
                                                checked={!!selectedForvaltninger.find((depName) => depName === dep)}
                                                tabIndex={-1}
                                                disableRipple
                                            />
                                        </ListItemIcon>
                                        <ListItemText primary={dep === null ? 'Ingen Forvaltning' : dep} />
                                    </ListItemButton>
                                </ListItem>)
                            ))
                        }
                    </List>
                </div>
            </Menu>
        </div>
    );
}
