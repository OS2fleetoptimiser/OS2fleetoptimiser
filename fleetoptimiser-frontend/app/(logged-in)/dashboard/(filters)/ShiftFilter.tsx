import {shift} from '@/components/hooks/useGetSettings';
import { Button, Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu } from '@mui/material';
import { useState } from 'react';
import { getInterval } from '../ShiftNameTranslater';
import LocationSettings from '@/app/(logged-in)/fleet/ShiftSettings';

type props = {
    selectedShifts: number[];
    setSelectedShifts: (id: number[]) => void;
    availableShifts?: (shift & { id: number })[];
};

export default function ShiftFilter({ selectedShifts, setSelectedShifts, availableShifts }: props) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const shiftName = (shift: { shift_start: string; shift_end: string }) => {
        return getInterval(shift.shift_start, shift.shift_end);
    };

    const checkedEvent = (id: number) => {
        const updated: number[] = [...selectedShifts];
        const checkedIndex = selectedShifts.indexOf(id);

        if (checkedIndex === -1) {
            updated.push(id);
            setSelectedShifts(updated);
        } else {
            updated.splice(checkedIndex, 1);
            setSelectedShifts(updated);
        }
    };

    return (
        <div>
            <Button onClick={handleClick}>Vagtlag ({selectedShifts.length})</Button>
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
                    {!availableShifts && <p>Der er ingen registrerede vagtlag</p>}
                    { availableShifts &&
                        <div>
                        <Button
                            className="w-full"
                            variant="outlined"
                            onClick={() => {
                                if (availableShifts) {
                                    if (selectedShifts.length < availableShifts.length) {
                                        setSelectedShifts(availableShifts.map((shift) => shift.id));
                                    } else {
                                        setSelectedShifts([]);
                                    }
                                }
                            }}
                        >
                            {availableShifts && selectedShifts.length < availableShifts.length ? 'Vælg Alle' : 'Fravælg Alle'}
                        </Button>
                        <List>
                    {availableShifts &&
                        availableShifts.map((shift) => (
                            <ListItem key={shift.id} disablePadding>
                                <ListItemButton role={undefined} onClick={() => checkedEvent(shift.id)} dense>
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={selectedShifts.find((id) => id === shift.id) !== undefined}
                                            tabIndex={-1}
                                            disableRipple
                                        />
                                    </ListItemIcon>
                                    <ListItemText primary={shift.id === null ? 'Ingen afdeling' : shiftName(shift)}/>
                                </ListItemButton>
                            </ListItem>
                        ))}
                </List></div>
                }
                    <LocationSettings buttonText="Indstil vagtlag" locationId={-1} />
                </div>
            </Menu>
        </div>
    );
}
