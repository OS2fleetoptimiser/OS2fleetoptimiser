import ToolTip from '@/components/ToolTip';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { Button, Dialog, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
interface CreateVehicleHierarchyProps {
    open: boolean;
    onClose: () => void;
}

const CreateVehicleHierarchy = ({ open, onClose }: CreateVehicleHierarchyProps) => {
    const vehicleTypes = [
        {
            value: 'Vehicle1',
            label: 'Personbil m.køl',
        },
        {
            value: 'Vehicle2',
            label: 'Personbil',
        },
        {
            value: 'Vehicle3',
            label: 'Lille personbil',
        },
        {
            value: 'BigVehicle1',
            label: 'Lastvogn',
        },

        {
            value: 'BigVehicle2',
            label: 'Varevogn',
        },
        {
            value: 'VehicleCool1',
            label: 'Kølebil',
        },
    ];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md">
            <DialogTitle className="border-b font-bold mb-2 pb-2">
                <span className="inline-flex items-center gap-1">
                    Lav Køretøjshierarki
                    <ToolTip>Vælg hvordan du ønsker at dit hierarki af køretøjer skal deles op.</ToolTip>
                </span>
            </DialogTitle>
            <DialogContent>
                <div>
                    <div className="mt-3 font-semibold flex space-x-4 justify-between">
                        <h1>Hierarki</h1>
                    </div>
                    <div className="mt-3 font-semibold flex space-x-4 justify-between">
                        <TextField id="outlined-basic" defaultValue="Personbiler" label="Køretøjs type" variant="outlined" />
                        <Checkbox defaultChecked />
                        <TextField className="w-64" id="outlined-select-currency" select label="Lag 1" defaultValue="Vehicle1">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 2" defaultValue="Vehicle2">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 3" defaultValue="Vehicle3">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                    <div className="mt-3 font-semibold flex space-x-4 justify-between">
                        <TextField id="outlined-basic" defaultValue="Kølebiler" label="Køretøjs type" variant="outlined" />
                        <Checkbox defaultChecked />
                        <TextField className="w-64" select label="Lag 1" defaultValue="VehicleCool1">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 2" defaultValue="Vehicle1">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 3" value="Vælg køretøj">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                    <div className="mt-3 font-semibold flex space-x-4 justify-between">
                        <TextField id="outlined-basic" defaultValue="Varebiler" label="Køretøjs type" variant="outlined" />
                        <Checkbox />
                        <TextField className="w-64" select label="Lag 1" defaultValue="BigVehicle1">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 2" defaultValue="BigVehicle2">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <ArrowRightAltIcon />
                        <TextField className="w-64" select label="Lag 3" value="Vælg køretøj">
                            {vehicleTypes.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </div>
                    <Button className="mt-3" variant="contained" color="primary">
                        Opret nyt hierarki
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
export default CreateVehicleHierarchy;
