import { Button, Checkbox, IconButton, InputAdornment, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, TextField } from '@mui/material';
import { useState } from 'react';
import { Search } from '@mui/icons-material';

export type props = {
    selectedLocations: number[];
    setSelectedLocations: (locations: number[]) => void;
    selectedVehicles: number[];
    setVehicles: (vehicles: number[]) => void;
    selectedDepartments: string[];
    setDepartments: (departments: string[]) => void;
    selectedForvaltninger?: string[];
    setSelectedForvaltninger?: (forvaltninger: string[]) => void;
};

type newProps = {
    setSelectedDepartments: (departments: string[]) => void;
    selectedDepartments: string[];
    selectableDepartments?: string[];
}

export default function DepartmentFilter({
    setSelectedDepartments,
    selectedDepartments,
    selectableDepartments,
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
            <Button onClick={handleClick}>Afdelinger ({selectedDepartments.length})</Button>
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
                            className="w-44"
                            variant="outlined"
                            onClick={() => {
                                if (selectableDepartments) {
                                    if (selectedDepartments.length < selectableDepartments.length) {
                                        setSelectedDepartments(selectableDepartments);
                                    } else {
                                        setSelectedDepartments([]);
                                    }
                                }
                            }}
                        >
                            {selectableDepartments && selectedDepartments.length < selectableDepartments.length ? 'Vælg Alle' : 'Fravælg Alle'}
                        </Button>
                    </div>
                    <List>
                       {selectableDepartments && selectedDepartments.some(selDep => !selectableDepartments.includes(selDep)) &&
                          <p className="text-explanation text-xs">Frigør andre filtre for at se alle valgte afdelinger</p>
                        }
                        {selectableDepartments && selectableDepartments.length === 0 && <p>Der er ingen tilgængelige afdelinger</p>}
                        {selectableDepartments &&
                            selectableDepartments
                            ?.filter((department) => department.toLowerCase().includes(searchQuery.toLowerCase()))
                            .sort((a, b) => a.localeCompare(b))
                            .map((department) => (
                                <ListItem key={department} disablePadding>
                                    <ListItemButton
                                        role={undefined}
                                        onClick={() => {
                                            const isAlreadySelected = !!selectedDepartments.find((depName) => depName === department);
                                            const updatedDepartments = isAlreadySelected
                                                ? selectedDepartments.filter((depName) => depName !== department)
                                                : [...selectedDepartments, department];
                                            setSelectedDepartments(updatedDepartments);
                                        }}
                                        dense>
                                        <ListItemIcon>
                                            <Checkbox
                                                edge="start"
                                                checked={!!selectedDepartments.find((id) => id === department)}
                                                tabIndex={-1}
                                                disableRipple
                                            />
                                        </ListItemIcon>
                                        <ListItemText primary={department === 'null' ? 'Ingen afdeling' : department} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                    </List>
                </div>
            </Menu>
        </div>
    );
}
