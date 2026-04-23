import VehicleModal from '@/app/(logged-in)/configuration/CreateOrUpdateVehicle';
import ImportModal from '@/app/(logged-in)/configuration/ImportModal';
import DeleteConfirmationDialog from '@/app/(logged-in)/configuration/DeleteConfirmationDialog';
import { exportDataToXlsx } from '@/app/(logged-in)/configuration/ExportHandler';
import MoveRoundTripsDialog from '@/app/(logged-in)/configuration/MoveRoundTripsDialog';
import API from '@/components/AxiosBase';
import { DropDownData } from '@/components/hooks/useGetDropDownData';
import { Vehicle } from '@/components/hooks/useGetVehicles';
import { Delete, Edit } from '@mui/icons-material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Power from '@mui/icons-material/Power';
import PowerOff from '@mui/icons-material/PowerOff';
import { Alert, Box, Button, Chip, IconButton, Snackbar, Tooltip } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { MaterialReactTable, useMaterialReactTable, MRT_ColumnDef, MRT_Row } from 'material-react-table';
import { MRT_Localization_DA } from 'material-react-table/locales/da';
import { useCallback, useMemo, useState } from 'react';
import DisableVehicleDialog from './DisableVehicleDialog';
import { useWritePrivilegeContext } from '@/app/providers/WritePrivilegeProvider';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneIcon from '@mui/icons-material/Done';

const VehicleConfigTable = ({ vehicleData, dropDownData, onDeleteRoundTrips }: { vehicleData: Vehicle[]; dropDownData: DropDownData; onDeleteRoundTrips: () => void }) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<MRT_Row<Vehicle> | null>(null);

    const [isMoveRoundTripsOpen, setIsMoveRoundTripsOpen] = useState(false);
    const [isCreateVehicleModalOpen, setIsCreateVehicleModalOpen] = useState(false);
    const [isUpdateVehicleModalOpen, setIsUpdateVehicleModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isCreatedSuccessSnackBarOpen, setIsCreatedSuccessSnackBarOpen] = useState(false);
    const [isUpdatedSuccessSnackBarOpen, setIsUpdatedSuccessSnackBarOpen] = useState(false);
    const [isDeletedInfoSnackBarOpen, setIsDeletedInfoSnackBarOpen] = useState(false);
    const [openDisableDialog, setOpenDisableDialog] = useState<boolean>(false);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const queryClient = useQueryClient();
    function handleCloseSuccessSnackbar() {
        setIsCreatedSuccessSnackBarOpen(false);
        setIsUpdatedSuccessSnackBarOpen(false);
        setIsDeletedInfoSnackBarOpen(false);
    }

    const handleCreateNewVehicle = () => {
        setIsCreatedSuccessSnackBarOpen(true);
    };
    const handleUpdateVehicle = () => {
        setIsUpdatedSuccessSnackBarOpen(true);
    };

    const handleDisableVehicle = (row: MRT_Row<Vehicle>) => {
        setSelectedRow(row);
        setOpenDisableDialog(true);
    };

    const handleDeleteRow = (row: MRT_Row<Vehicle>) => {
        setSelectedRow(row);
        setIsDialogOpen(true);
    };

    const handleMoveRoundTrips = (row: MRT_Row<Vehicle>) => {
        setSelectedRow(row);
        setIsMoveRoundTripsOpen(true);
    };

    const handleMoveRoundTripsClose = () => {
        setIsMoveRoundTripsOpen(false);
    };

    const handleEditVehicle = useCallback((row: MRT_Row<Vehicle>) => {
        setSelectedRow(row);
        setIsUpdateVehicleModalOpen(true);
    }, []);

    const handleDialogClose = useCallback(
        async (confirmed: boolean) => {
            setIsDialogOpen(false);
            if (confirmed && selectedRow) {
                try {
                    const response = await API.delete('configuration/vehicle/' + selectedRow.original.id);
                    if (response.status === 200) {
                        await queryClient.invalidateQueries({
                            queryKey: ['vehicles']
                        });
                        setIsDeletedInfoSnackBarOpen(true);
                    }
                } catch (error: unknown) {
                    if (isAxiosError(error) && error.response?.status === 422) {
                        console.log('Something went wrong');
                    }
                }
            }
            setSelectedRow(null);
        },
        [queryClient, selectedRow]
    );

    const refetchVehicles = async () => {
        await queryClient.invalidateQueries({
            queryKey: ['vehicles']
        });
    };

    const hasImei = useMemo(() => {
        return vehicleData.some((vehicle) => Boolean(vehicle.imei));
    }, [vehicleData]);

    // client side evaluation of missing data and ended leasing for coloring vehicle by status
    const hasMissingData = (row: Vehicle) => {
        const cond1 = row.end_leasing == null && [1, 2].includes(row.leasing_type?.id || -1);
        const cond2 = row.wltp_el == null && row.wltp_fossil == null && row.fuel?.id != 10;
        const cond3 = row.omkostning_aar == null;
        return cond1 || cond2 || cond3;
    };

    const hasEndedLeasing = (row: Vehicle) => {
        const now = dayjs();
        return dayjs(row.end_leasing).isBefore(now);
    };

    const getStatus = (vehicle: Vehicle) => {
        if (vehicle.disabled) return <Chip variant="outlined" color="default" label="Deaktiveret" />;
        if (hasMissingData(vehicle)) return <Chip variant="outlined" color="error" label="Manglende metadata" />;
        if (vehicle.test_vehicle) return <Chip variant="outlined" color="info" label="Testkøretøj" />;
        if (hasEndedLeasing(vehicle)) return <Chip variant="outlined" color="warning" label="Udløbet leasing" />;
        return <Chip variant="outlined" color="success" icon={<DoneIcon />} label="OK" />;
    };

    const columns = useMemo<MRT_ColumnDef<Vehicle>[]>(() => {
        const baseColumns: MRT_ColumnDef<Vehicle>[] = [
            {
                header: 'Status',
                size: 100,
                Cell: ({ row }) => getStatus(row.original),
                accessorFn: (row) => {
                    if (row.disabled) return 'Deaktiveret';
                    if (hasMissingData(row)) return 'Manglende metadata';
                    if (row.test_vehicle) return 'Testkøretøj';
                    if (hasEndedLeasing(row)) return 'Udløbet leasing';
                    return 'OK';
                },
                sortingFn: 'basic',
            },
            {
                accessorFn: (row) => row.id,
                accessorKey: 'id',
                header: 'ID',
                enableEditing: false, //disable editing on this column
                size: 80,
            },
            {
                accessorFn: (row) => row.plate ?? '',
                accessorKey: 'plate',
                header: 'Nummerplade',
                size: 120,
            },
            {
                accessorFn: (row) => row.make ?? '',
                accessorKey: 'make',
                header: 'Mærke',
                size: 120,
            },
            {
                accessorFn: (row) => row.model,
                accessorKey: 'model',
                header: 'Model',
                size: 180, //medium column
            },
            {
                accessorFn: (row) => row.type?.name,
                accessorKey: 'type',
                header: 'Type',
                size: 40,
            },
            {
                accessorFn: (row) => row.wltp_fossil,
                accessorKey: 'wltp_fossil',
                header: 'WLTP (fossil)',
                size: 20,
            },
            {
                accessorFn: (row) => row.wltp_el,
                accessorKey: 'wltp_el',
                header: 'WLTP (el)',
                size: 20,
            },
            {
                accessorFn: (row) => row.omkostning_aar,
                accessorKey: 'omkostning_aar',
                header: 'Omk./år',
                size: 80,
            },
            {
                accessorFn: (row) => row.forvaltning,
                accessorKey: 'forvaltning',
                header: 'Forv.',
                size: 140,
            },
            {
                accessorFn: (row) => row.location?.address,
                accessorKey: 'location',
                header: 'Lokation',
                size: 140,
            },
            {
                accessorFn: (row) => row.department,
                accessorKey: 'department',
                header: 'Afd.',
                size: 80,
            },
            {
                accessorFn: (row) => {
                    return row.end_leasing ? dayjs(row.end_leasing).format('DD-MM-YYYY') : null;
                },
                accessorKey: 'end_leasing',
                header: 'Slut leasing',
                size: 80,
            },
        ];
        if (hasImei) {
            const imeiColumn: MRT_ColumnDef<Vehicle> = {
                accessorFn: (row) => row.imei,
                accessorKey: 'imei',
                header: 'IMEI',
                enableEditing: false,
                size: 120,
            };
            baseColumns.splice(1, 0, imeiColumn);
        }
        return baseColumns;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasImei]);

    const table = useMaterialReactTable({
        columns,
        data: vehicleData,
        muiTableHeadCellProps: {
            sx: {
                backgroundColor: 'background.default',
                color: 'text.secondary',
                fontWeight: 500,
            },
        },
        muiTableBodyRowProps: {
            sx: { backgroundColor: 'background.paper' },
        },
        muiTablePaperProps: {
            variant: 'outlined',
            elevation: 0,
        },
        muiPaginationProps: {
            SelectProps: {
                sx: {
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    backgroundColor: 'transparent',
                    border: 'none',
                },
            },
        },
        enableTopToolbar: true,
        enableDensityToggle: false,
        localization: MRT_Localization_DA,
        initialState: {
            density: 'compact',
        },
        state: { pagination },
        onPaginationChange: setPagination,
        autoResetPageIndex: false,
        enableEditing: true,
        enableStickyHeader: true,
        renderRowActions: ({ row }) => {
            const readOnlyTitle = 'Du har læserettigheder';
            return (
                <Box className="flex">
                    <Tooltip arrow placement="left" title={hasWritePrivilege ? 'Rediger' : readOnlyTitle}>
                        <span>
                            <IconButton size="medium" disabled={!hasWritePrivilege} onClick={() => handleEditVehicle(row)}>
                                <Edit fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip arrow placement="right" title={hasWritePrivilege ? 'Slet' : readOnlyTitle}>
                        <span>
                            <IconButton size="medium" color="error" disabled={!hasWritePrivilege} onClick={() => handleDeleteRow(row)}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip
                        arrow
                        placement="right"
                        title={hasWritePrivilege ? (row.original.disabled ? 'Aktiver køretøj' : 'Deaktiver køretøj') : readOnlyTitle}
                    >
                        <span>
                            <IconButton
                                size="medium"
                                color={row.original.disabled ? undefined : 'success'}
                                disabled={!hasWritePrivilege}
                                onClick={() => handleDisableVehicle(row)}
                            >
                                {row.original.disabled ? <PowerOff fontSize="small" /> : <Power fontSize="small" />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip arrow placement="right" title={hasWritePrivilege ? 'Flyt Rundture' : readOnlyTitle}>
                        <span>
                            <IconButton size="medium" disabled={!hasWritePrivilege} onClick={() => handleMoveRoundTrips(row)}>
                                <LocationOnIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            );
        },
        renderDetailPanel: ({ row }) => (
            <Box sx={{ backgroundColor: 'background.default' }} className="w-full grid m-auto">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell className="text-center font-semibold">Drivmiddel</TableCell>
                            <TableCell className="text-center font-semibold">Procentvis WLTP nedskrivning</TableCell>
                            <TableCell className="text-center font-semibold">Rækkevidde (km)</TableCell>
                            <TableCell className="text-center font-semibold">Start leasing</TableCell>
                            <TableCell className="text-center font-semibold">Leasing Type</TableCell>
                            <TableCell className="text-center font-semibold">Tilladt km/år</TableCell>
                            <TableCell className="text-center font-semibold">Hviletid</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow key={row.id}>
                            <TableCell component="th" scope="row" align="center">
                                {row.original.fuel?.name}
                            </TableCell>
                            <TableCell className="text-center">{row.original.capacity_decrease}</TableCell>
                            <TableCell className="text-center">{row.original.range}</TableCell>
                            <TableCell className="text-center">
                                {row.original.start_leasing ? dayjs(row.original.start_leasing).format('DD-MM-YYYY') : null}
                            </TableCell>
                            <TableCell className="text-center">{row.original.leasing_type?.name}</TableCell>
                            <TableCell className="text-center">{row.original.km_aar}</TableCell>
                            <TableCell className="text-center">{row.original.sleep}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Box>
        ),
    });

    return (
        <>
            <div className="flex justify-end mb-2">
                <Tooltip title={hasWritePrivilege ? '' : 'Du har læserettigheder'}>
                    <span>
                        <Button
                            disabled={!hasWritePrivilege}
                            color="primary"
                            onClick={() => setIsCreateVehicleModalOpen(true)}
                            startIcon={<AddIcon />}
                            variant="contained"
                        >
                            Tilføj nyt køretøj
                        </Button>
                    </span>
                </Tooltip>
            </div>
            <MaterialReactTable table={table} />
            <div className="flex justify-end items-center gap-2 mt-2">
                <Button
                    onClick={() => {
                        const filteredRows = table.getPrePaginationRowModel().rows.map((row: MRT_Row<Vehicle>) => row.original);
                        exportDataToXlsx(columns, filteredRows);
                    }}
                    startIcon={<FileDownloadIcon />}
                    variant="outlined"
                >
                    Eksporter til .xlsx
                </Button>
                <Tooltip title={hasWritePrivilege ? '' : 'Du har læserettigheder'}>
                    <span>
                        <Button
                            disabled={!hasWritePrivilege}
                            onClick={() => setIsImportModalOpen(true)}
                            startIcon={<FileUploadIcon />}
                            variant="outlined"
                        >
                            Importer flådedata
                        </Button>
                    </span>
                </Tooltip>
                <Button
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    disabled={!hasWritePrivilege}
                    color="error"
                    onClick={onDeleteRoundTrips}
                >
                    Automatisk tursletning
                </Button>
            </div>
            {isMoveRoundTripsOpen && (
                <MoveRoundTripsDialog
                    isOpen={isMoveRoundTripsOpen}
                    onClose={handleMoveRoundTripsClose}
                    idValue={selectedRow?.getValue('id')}
                    plateValue={selectedRow?.getValue('plate')}
                    makeValue={selectedRow?.getValue('make')}
                    modelValue={selectedRow?.getValue('model')}
                    locationAddress={selectedRow?.getValue('location')}
                    dropDownData={dropDownData}
                />
            )}
            {isDialogOpen && (
                <DeleteConfirmationDialog
                    isOpen={isDialogOpen}
                    onClose={handleDialogClose}
                    idValue={selectedRow?.getValue('id')}
                    plateValue={selectedRow?.getValue('plate')}
                    makeValue={selectedRow?.getValue('make')}
                    modelValue={selectedRow?.getValue('model')}
                />
            )}
            {isUpdateVehicleModalOpen && (
                <VehicleModal
                    dropDownData={dropDownData}
                    open={isUpdateVehicleModalOpen}
                    onClose={() => setIsUpdateVehicleModalOpen(false)}
                    submit={handleUpdateVehicle}
                    initialValues={selectedRow?.original}
                    isUpdate={true}
                />
            )}
            {isCreateVehicleModalOpen && (
                <VehicleModal
                    dropDownData={dropDownData}
                    open={isCreateVehicleModalOpen}
                    onClose={() => setIsCreateVehicleModalOpen(false)}
                    submit={handleCreateNewVehicle}
                    initialValues={undefined}
                    isUpdate={false}
                />
            )}

            {isImportModalOpen && <ImportModal open={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} refetch={() => refetchVehicles()} />}

            {isCreatedSuccessSnackBarOpen && (
                <Snackbar open={isCreatedSuccessSnackBarOpen} autoHideDuration={2000} onClose={handleCloseSuccessSnackbar}>
                    <Alert severity="success">Køretøj er oprettet</Alert>
                </Snackbar>
            )}
            {isUpdatedSuccessSnackBarOpen && (
                <Snackbar open={isUpdatedSuccessSnackBarOpen} autoHideDuration={2000} onClose={handleCloseSuccessSnackbar}>
                    <Alert severity="success">Køretøj er opdateret</Alert>
                </Snackbar>
            )}
            {isDeletedInfoSnackBarOpen && (
                <Snackbar open={isDeletedInfoSnackBarOpen} autoHideDuration={2000} onClose={handleCloseSuccessSnackbar}>
                    <Alert severity="info">Køretøj er nu slettet</Alert>
                </Snackbar>
            )}
            {selectedRow && (
                <DisableVehicleDialog
                    vehicle={selectedRow!.original}
                    open={openDisableDialog}
                    handleClose={() => setOpenDisableDialog(false)}
                ></DisableVehicleDialog>
            )}
        </>
    );
};
export default VehicleConfigTable;
