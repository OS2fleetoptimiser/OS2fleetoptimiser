import React, { ReactNode, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Select,
    Chip,
    SelectChangeEvent,
    ButtonGroup,
    CircularProgress,
} from '@mui/material';
import { useMediaQuery } from 'react-responsive';
import { VehicleWithStatus } from '@/components/hooks/useGetVehiclesByLocation';
import { BpIcon, BpCheckedIcon } from './CheckBoxIcons';
import Tooltip from '@mui/material/Tooltip';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ElectricCarIcon from '@mui/icons-material/ElectricCar';
import ElectricBikeIcon from '@mui/icons-material/ElectricBike';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MemoryIcon from '@mui/icons-material/Memory';
import { useRouter } from 'next/navigation';
import DownloadIcon from '@mui/icons-material/Download';
import { prepareGoalSimulation } from "@/components/redux/SimulationSlice";
import { useAppDispatch } from "@/components/redux/hooks";

interface VehiclePickerProps {
    vehicles: VehicleWithStatus[];
    selectedVehicleIds: number[];
    onSelectionChange: (vehicleIds: number[]) => void;
    isLoading: boolean;
    simulationDisabled: boolean;
    onDownload?: () => void;
}

interface DepartmentFilterProps {
    allDepartments: string[];
    selectedDepartment?: string;
    setSelectedDepartment: (departments: string) => void;
}

const DepartmentVehicleFilter = ({ allDepartments, selectedDepartment, setSelectedDepartment }: DepartmentFilterProps) => {
    const handleChange = (event: SelectChangeEvent<string>) => {
        setSelectedDepartment(event.target.value);
    };

    return (
        <FormControl variant="outlined" size="small" className="min-w-[150px]">
            <InputLabel id="department-filter-label" className="text-[0.875rem] text-gray-600">
                Afdeling
            </InputLabel>
            <Select
                labelId="department-filter-label"
                value={selectedDepartment}
                onChange={handleChange}
                label="Afdeling"
                className="text-[0.875rem] text-gray-600"
                renderValue={(selected) => <Chip label={selected || 'Alle'} size="small" className="bg-gray-50 text-gray-500 text-sm font-bold" />}
                sx={{
                    '& .MuiSelect-select': { padding: '8px' },
                }}
            >
                <MenuItem value="">
                    <em>Alle</em>
                </MenuItem>
                {allDepartments.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                        {dept}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default function VehiclePicker({ vehicles, selectedVehicleIds, onSelectionChange, isLoading, simulationDisabled, onDownload }: VehiclePickerProps) {
    const router = useRouter();
    const dispatch = useAppDispatch();

    // show progressively more vehicle data in the table
    const isXlScreen = useMediaQuery({ minWidth: '1280px' });
    const isLargeScreen = useMediaQuery({ minWidth: '1024px' });
    const isMediumScreen = useMediaQuery({ minWidth: '768px' });
    const [filteredDepartment, setFilteredDepartments] = useState<string>();

    const propellantFormat = (vehicle: VehicleWithStatus) => {
        if (vehicle.wltp_el) {
            return vehicle.wltp_el.toLocaleString() + ' Wh/km';
        } else if (vehicle.wltp_fossil) {
            return vehicle.wltp_fossil.toLocaleString() + ' km/l';
        } else {
            return 'Intet drivmiddel';
        }
    };
    const iconLookup = (vtype: string | undefined): ReactNode => {
        switch (vtype) {
            case 'fossilbil':
                return <DirectionsCarIcon className="mr-2" />;
            case 'elbil':
                return <ElectricCarIcon className="mr-2" />;
            case 'elcykel':
                return <ElectricBikeIcon className="mr-2" />;
            case 'cykel':
                return <PedalBikeIcon className="mr-2" />;
            case undefined:
                return <HelpOutlineIcon className="mr-2" />;
        }
    };
    const getTextToolTip = (text?: string, cutCharacters: number = 20) => {
        if (!text) return <></>;
        return text.length > cutCharacters ? (
            <Tooltip placement="top" title={text}>
                <span>{text.slice(0, cutCharacters) + '...'}</span>
            </Tooltip>
        ) : (
            <span>{text}</span>
        );
    };

    const getToolTipInfo = (vehicleStatus: string) => {
        if (vehicleStatus === 'dataMissing')
            return 'Køretøjet mangler metadata, men har været aktiv på lokationen i den valgte datoperiode. Gå til konfigurationen, find køretøjet og tilføj som minimum mærke, model, wltp og omkostning år for køretøjet.';
        if (vehicleStatus === 'notActive') return 'Køretøjet er tilknyttet denne lokation, men har ikke været aktiv i den valgte datoperiode.';
        if (vehicleStatus === 'leasingEnded')
            return 'Køretøjet har overgået slut-dato for leasingperioden, men har fortsat været aktiv på lokationen i den valgte datoperiode. Gå til konfigurationen for at ændre datoen for den valgte slut-dato.';
        if (vehicleStatus === 'locationChanged')
            return 'Køretøjet har fået skiftet sin lokation, men har været aktiv på denne lokation i den valgte datoperiode. Dvs. køretøjet er tilknyttet en anden lokation end denne og vil fremover kun bidrage med nye ture til lokationen valgt i konfigurationen.';
        return '';
    };
    const getStatusChip = (vehicleStatus: string) => {
        if (vehicleStatus === 'dataMissing') return <Chip size="small" variant="outlined" color="error" label="Manglende metadata" />;
        if (vehicleStatus === 'leasingEnded')
            return <Chip size="small" style={{ color: '#ca8a04', borderColor: '#ca8a04' }} variant="outlined" label="Udløbet leasing" />;
        if (vehicleStatus === 'locationChanged')
            return <Chip size="small" style={{ color: '#ca8a04', borderColor: '#ca8a04' }} variant="outlined" label="Lokation skiftet" />;
        if (vehicleStatus === 'notActive') return <Chip color="primary" variant="outlined" size="small" label="Ikke aktiv" />;
        return <Chip variant="outlined" color="success" label="OK" />;
    };

    const toggleVehicle = (id: number) => {
        const newSelected = selectedVehicleIds.includes(id) ? selectedVehicleIds.filter((v) => v !== id) : [...selectedVehicleIds, id];
        onSelectionChange(newSelected);
    };

    const selectAll = () => {
        const filteredVehicles = vehicles.filter((vehicle) => {
            return !filteredDepartment || (vehicle.department ? vehicle.department === filteredDepartment : filteredDepartment === 'Ingen afdeling');
        });
        onSelectionChange(filteredVehicles.map((v) => v.id));
    };

    const deselectAll = () => {
        const filteredVehicles = vehicles.filter((vehicle) => {
            return !filteredDepartment || (vehicle.department ? vehicle.department === filteredDepartment : filteredDepartment === 'Ingen afdeling');
        });

        const filteredVehicleIds = filteredVehicles.map((v) => v.id);
        const newSelectedVehicleIds = selectedVehicleIds.filter((id) => !filteredVehicleIds.includes(id));
        onSelectionChange(newSelectedVehicleIds);
    };
    const headerStyle = 'p-3 text-gray-500 text-sm font-bold bg-gray-50';
    const allDepartments = Array.from(new Set(vehicles.map((vehicle) => vehicle.department || 'Ingen afdeling')));
    return (
        <div className="pr">
            <div className="mt-2">
                <div className="flex flex-row">
                    <label className="block mb-2 text-lg font-semibold text-black">Vælg køretøjer til simulering</label>
                    {onDownload && (
                        <Button onClick={onDownload} startIcon={<DownloadIcon />} size="small" className="ml-auto" variant="outlined">
                            Download dataperiode
                        </Button>
                    )}
                </div>
                <TableContainer
                        component={Paper}
                        className={`relative my-4 shadow-sm border border-gray-100 rounded-md max-h-[calc(100vh-450px)] ${isLoading ? 'overflow-hidden' : 'overflow-auto'}`}
                    >
                        {isLoading && (
                            <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-10" style={{ pointerEvents: 'auto' }}>
                                <CircularProgress />
                            </div>
                        )}
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox" className={headerStyle} />
                                <TableCell className={headerStyle}>Køretøjer</TableCell>
                                <TableCell className={headerStyle}>WLTP</TableCell>
                                <TableCell className={headerStyle}>Omkostning / år</TableCell>
                                {isMediumScreen && (
                                    <TableCell className={headerStyle}>
                                        <div className="flex items-center">
                                            <DepartmentVehicleFilter
                                                allDepartments={allDepartments}
                                                selectedDepartment={filteredDepartment}
                                                setSelectedDepartment={setFilteredDepartments}
                                            />
                                        </div>
                                    </TableCell>
                                )}
                                {isLargeScreen && <TableCell className={headerStyle}>Lokation</TableCell>}
                                {isXlScreen && <TableCell className={headerStyle}>Slut leasing</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {vehicles
                                .sort((a, b) => {
                                    if ((a.status !== 'ok') !== (b.status !== 'ok')) {
                                        // sort first on status
                                        return a.status !== 'ok' ? -1 : 1;
                                    }
                                    const addressA = a.location?.address || ''; // second on location
                                    const addressB = b.location?.address || '';
                                    if (addressA !== addressB) {
                                        return addressA.localeCompare(addressB);
                                    }
                                    return a.name.localeCompare(b.name); // finally on vehicle name
                                })
                                .map((vehicle, index) => {
                                    if (
                                        !(
                                            (// if departments is selected and the vehicle has that department
                                            (!filteredDepartment || // if no departments is selected at all
                                            (vehicle.department && filteredDepartment === vehicle.department) || (!vehicle.department && filteredDepartment === 'Ingen afdeling'))) // if departments is not set on the vehicle and departments is selected
                                        )
                                    ) {
                                        return;
                                    }
                                    const isChecked = selectedVehicleIds.includes(vehicle.id);
                                    const leasingDate = vehicle.end_leasing ? new Date(vehicle.end_leasing).toLocaleDateString() : 'Ejet';
                                    const rowStyle = `p-2 align-middle`;

                                    return (
                                        <Tooltip key={`${vehicle.id}_tooltip`} placement="top" title={getToolTipInfo(vehicle.status)}>
                                            <TableRow
                                                key={vehicle.id}
                                                className={`cursor-pointer hover:bg-gray-50 text-sm ${
                                                    index < vehicles.length - 1 ? 'border-b border-gray-100' : ''
                                                }`}
                                                onClick={() => toggleVehicle(vehicle.id)}
                                            >
                                                <TableCell padding="checkbox" className={rowStyle}>
                                                    {vehicle.status !== 'dataMissing' && (
                                                        <Checkbox
                                                            sx={{ '&:hover': { bgcolor: 'transparent' } }}
                                                            checkedIcon={<BpCheckedIcon />}
                                                            icon={<BpIcon />}
                                                            checked={isChecked}
                                                            onChange={() => toggleVehicle(vehicle.id)}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className={`${rowStyle}`}>
                                                    <div className="items-center flex space-x-1">
                                                        {iconLookup(vehicle.type?.name)} {getTextToolTip(vehicle.name, 35)}{' '}
                                                        {vehicle.status !== 'ok' && <div className="pl-2">{getStatusChip(vehicle.status)}</div>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className={rowStyle}>{propellantFormat(vehicle)}</TableCell>
                                                <TableCell className={rowStyle}>
                                                    {vehicle.omkostning_aar ? `${vehicle.omkostning_aar.toLocaleString()}` : '-'}
                                                </TableCell>
                                                {isMediumScreen && <TableCell className={rowStyle}>{vehicle.department || 'Ingen afdeling'}</TableCell>}
                                                {isLargeScreen && <TableCell className={rowStyle}>{getTextToolTip(vehicle.location?.address) || ''}</TableCell>}
                                                {isXlScreen && <TableCell className={rowStyle}>{leasingDate}</TableCell>}
                                            </TableRow>
                                        </Tooltip>
                                    );
                                })}
                        </TableBody>
                    </Table>
                    <div className="sticky bottom-0 bg-white border-t border-gray-100 flex justify-between items-center sm:flex-row space-y-2 sm:space-y-0 flex-col p-2 py-4">
                        <ButtonGroup>
                            <Button variant="outlined" size="small" onClick={selectAll}>
                                Vælg alle
                            </Button>
                            <Button variant="outlined" size="small" onClick={deselectAll}>
                                Fravælg alle
                            </Button>
                        </ButtonGroup>

                        <div className="flex space-x-2 md:flex-row md:space-y-0 space-y-2 flex-col">
                            <Button
                                disabled={simulationDisabled}
                                onClick={() => router.push('/fleet')}
                                startIcon={<DirectionsCarIcon />}
                                variant="contained"
                                size="small"
                            >
                                Manuel simulering
                            </Button>
                            <Button
                                disabled={simulationDisabled}
                                startIcon={<MemoryIcon />}
                                onClick={async () => {
                                  await dispatch(prepareGoalSimulation());
                                  router.push('/goal');
                              }}
                                variant="contained"
                                size="small"
                            >
                                Automatisk simulering
                            </Button>
                        </div>
                    </div>
                </TableContainer>
            </div>
        </div>
    );
}
