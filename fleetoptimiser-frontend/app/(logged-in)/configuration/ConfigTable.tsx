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
import MaterialReactTable, { MRT_ColumnDef, MRT_Row } from 'material-react-table';
import { MRT_Localization_DA } from 'material-react-table/locales/da';
import { useCallback, useMemo, useState } from 'react';
import DisableVehicleDialog from './DisableVehicleDialog';
import { useWritePrivilegeContext } from '@/app/providers/WritePrivilegeProvider';
import ToolTip from '@/components/ToolTip';
import DoneIcon from '@mui/icons-material/Done';

const VehicleConfigTable = ({ vehicleData, dropDownData }: { vehicleData: Vehicle[]; dropDownData: DropDownData }) => {
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
                        await queryClient.invalidateQueries(['vehicles']);
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
        await queryClient.invalidateQueries(['vehicles']);
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

    const getCellColor = (vehicle: Vehicle) => {
        if (hasMissingData(vehicle)) return 'text-red-600';
        if (hasEndedLeasing(vehicle)) return 'text-yellow-600';
    };

    const getStatus = (vehicle: Vehicle) => {
        if (vehicle.disabled) return <Chip variant="outlined" style={{ color: '#888', borderColor: '#888' }} label="Deaktiveret"></Chip>;
        if (hasMissingData(vehicle)) return <Chip variant="outlined" color="error" label="Manglende metadata"></Chip>;
        if (hasEndedLeasing(vehicle)) return <Chip style={{ color: '#ca8a04', borderColor: '#ca8a04' }} variant="outlined" label="Udløbet leasing"></Chip>;
        return <Chip variant="outlined" color="success" label="OK" deleteIcon={<DoneIcon />} onDelete={() => 'render icon'}></Chip>;
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
    }, [hasImei]);

    return (
        <>
            <MaterialReactTable
                muiTableHeadCellProps={{
                    className: 'bg-white',
                }}
                muiTableBodyRowProps={{
                    className: 'bg-white hover:bg-gray-100 ',
                }}
                muiTableDetailPanelProps={{
                    className: 'bg-white',
                }}
                muiBottomToolbarProps={{
                    className: 'bg-white',
                }}
                muiTopToolbarProps={{
                    className: 'bg-white',
                }}
                columns={columns}
                data={vehicleData}
                enableDensityToggle={false}
                localization={MRT_Localization_DA}
                initialState={{
                    density: 'compact',
                }}
                state={{ pagination }}
                onPaginationChange={setPagination}
                autoResetPageIndex={false}
                enableEditing
                enableStickyHeader
                renderRowActions={({ row }) => (
                    <Box className="flex">
                        {hasWritePrivilege && (
                            <>
                                <Tooltip arrow placement="left" title="Rediger">
                                    <IconButton onClick={() => handleEditVehicle(row)}>
                                        <Edit />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip arrow placement="right" title="Slet">
                                    <IconButton color="error" onClick={() => handleDeleteRow(row)}>
                                        <Delete />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip arrow placement="right" title={row.original.disabled ? 'Aktiver køretøj' : 'Deaktiver køretøj'}>
                                    <IconButton color={row.original.disabled ? undefined : 'success'} onClick={() => handleDisableVehicle(row)}>
                                        {row.original.disabled ? <PowerOff /> : <Power />}
                                    </IconButton>
                                </Tooltip>
                                <Tooltip arrow placement="right" title="Flyt Rundture">
                                    <IconButton onClick={() => handleMoveRoundTrips(row)}>
                                        <LocationOnIcon />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                        {!hasWritePrivilege && (
                            <>
                                <Tooltip title="Du har læserettigheder">
                                    <>
                                        <Edit color="info" />
                                        <Delete color="info" />
                                        {row.original.disabled ? <PowerOff color="info" /> : <Power color="info" />}
                                        <LocationOnIcon color="info" />
                                    </>
                                </Tooltip>
                            </>
                        )}
                    </Box>
                )}
                renderDetailPanel={({ row }) => (
                    <Box className="bg-gray-100 w-full grid m-auto">
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
                )}
                renderTopToolbarCustomActions={({ table }) => (
                    <div className="flex gap-4">
                        <Button
                            color="primary"
                            onClick={() => {
                                const filteredRows = table.getPrePaginationRowModel().rows.map((row) => row.original);
                                exportDataToXlsx(columns, filteredRows);
                            }}
                            startIcon={<FileDownloadIcon />}
                            variant="contained"
                        >
                            Eksporter Til .xlsx
                        </Button>
                        <Tooltip title={hasWritePrivilege ? '' : 'Du har læserettigheder'}>
                            <Button
                                disabled={!hasWritePrivilege}
                                color="primary"
                                onClick={() => setIsImportModalOpen(true)}
                                startIcon={<FileUploadIcon />}
                                variant="contained"
                            >
                                Importer flådedata
                            </Button>
                        </Tooltip>
                        <ToolTip>
                            Importering af data, er kun for køretøjer, der er forbundet via. dit flådestyringssystem. Dvs. IDet skal stemme overens med et kendt
                            køretøj i dit flådesystem. Brug Tilføj nyt køretøj for at tilføje nye testkøretøjer.
                        </ToolTip>
                    </div>
                )}
                renderBottomToolbarCustomActions={() => (
                    <div>
                        <Tooltip title={hasWritePrivilege ? '' : 'Du har læserettigheder'}>
                            <Button disabled={!hasWritePrivilege} color="primary" onClick={() => setIsCreateVehicleModalOpen(true)} variant="contained">
                                Tilføj nyt køretøj
                            </Button>
                        </Tooltip>
                    </div>
                )}
            />
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
