import { useMemo, forwardRef } from 'react'
import { Button, Card, Checkbox, Chip, Tooltip, Typography } from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams, GridRowSelectionModel } from '@mui/x-data-grid'
import { daDK } from '@mui/x-data-grid/locales'
import { VehicleWithStatus } from '@/components/hooks/useGetVehiclesByLocation'
import { BpIcon, BpCheckedIcon } from './CheckBoxIcons'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import MemoryIcon from '@mui/icons-material/Memory'
import DownloadIcon from '@mui/icons-material/Download'
import { useRouter } from 'next/navigation'
import { prepareGoalSimulation } from '@/components/redux/SimulationSlice'
import { useAppDispatch } from '@/components/redux/hooks'

const RoundedCheckbox = forwardRef<HTMLButtonElement, any>((props, ref) => (
    <Checkbox ref={ref} {...props} icon={<BpIcon />} checkedIcon={<BpCheckedIcon />} />
))

interface VehiclePickerProps {
    vehicles: VehicleWithStatus[]
    selectedVehicleIds: number[]
    onSelectionChange: (vehicleIds: number[]) => void
    isLoading: boolean
    simulationDisabled: boolean
    onDownload?: () => void
}

function getStatusChip(status: string) {
    if (status === 'dataMissing') return <Chip color="error" label="Manglende metadata" />
    if (status === 'leasingEnded') return <Chip color="warning" label="Udløbet leasing" />
    if (status === 'locationChanged') return <Chip color="warning" label="Lokation skiftet" />
    if (status === 'notActive') return <Chip color="default" label="Ikke aktiv" />
    return <Chip color="success" label="OK" />
}

function getToolTipInfo(status: string) {
    if (status === 'dataMissing')
        return 'Køretøjet mangler metadata, men har været aktiv på lokationen i den valgte datoperiode. Gå til konfigurationen, find køretøjet og tilføj som minimum mærke, model, wltp og omkostning år for køretøjet.'
    if (status === 'notActive') return 'Køretøjet er tilknyttet denne lokation, men har ikke været aktiv i den valgte datoperiode.'
    if (status === 'leasingEnded')
        return 'Køretøjet har overgået slut-dato for leasingperioden, men har fortsat været aktiv på lokationen i den valgte datoperiode. Gå til konfigurationen for at ændre datoen for den valgte slut-dato.'
    if (status === 'locationChanged')
        return 'Køretøjet har fået skiftet sin lokation, men har været aktiv på denne lokation i den valgte datoperiode. Dvs. køretøjet er tilknyttet en anden lokation end denne og vil fremover kun bidrage med nye ture til lokationen valgt i konfigurationen.'
    return ''
}

export default function VehiclePicker({ vehicles, selectedVehicleIds, onSelectionChange, isLoading, simulationDisabled, onDownload }: VehiclePickerProps) {
    const router = useRouter()
    const dispatch = useAppDispatch()

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: 'name',
                headerName: 'Køretøj',
                flex: 1.5,
                minWidth: 200,
            },
            {
                field: 'status',
                headerName: 'Status',
                flex: 0.7,
                minWidth: 130,
                renderCell: (params: GridRenderCellParams) => {
                    const vehicle = params.row as VehicleWithStatus
                    const chip = getStatusChip(vehicle.status)
                    const tooltip = getToolTipInfo(vehicle.status)
                    return tooltip ? (
                        <Tooltip placement="top" title={tooltip}>{chip}</Tooltip>
                    ) : chip
                },
            },
            {
                field: 'type',
                headerName: 'Type',
                flex: 0.6,
                minWidth: 90,
                valueGetter: (_value: unknown, row: VehicleWithStatus) => row.type?.name || 'Ukendt',
            },
            {
                field: 'wltp',
                headerName: 'WLTP',
                flex: 0.7,
                minWidth: 100,
                valueGetter: (_value: unknown, row: VehicleWithStatus) => {
                    if (row.wltp_el) return row.wltp_el
                    if (row.wltp_fossil) return row.wltp_fossil
                    return null
                },
                renderCell: (params: GridRenderCellParams) => {
                    const vehicle = params.row as VehicleWithStatus
                    if (vehicle.wltp_el) return `${vehicle.wltp_el.toLocaleString()} Wh/km`
                    if (vehicle.wltp_fossil) return `${vehicle.wltp_fossil.toLocaleString()} km/l`
                    return 'Intet drivmiddel'
                },
            },
            {
                field: 'omkostning_aar',
                headerName: 'Omkostning / år',
                type: 'number',
                flex: 0.7,
                minWidth: 120,
                valueFormatter: (value: number | null) => value ? value.toLocaleString() : '-',
            },
            {
                field: 'department',
                headerName: 'Afdeling',
                flex: 0.8,
                minWidth: 120,
                valueGetter: (_value: unknown, row: VehicleWithStatus) => row.department || 'Ingen afdeling',
            },
            {
                field: 'location',
                headerName: 'Lokation',
                flex: 1,
                minWidth: 150,
                valueGetter: (_value: unknown, row: VehicleWithStatus) => row.location?.address || '',
            },
            {
                field: 'end_leasing',
                headerName: 'Slut leasing',
                flex: 0.7,
                minWidth: 110,
                valueFormatter: (value: string | null) =>
                    value ? new Date(value).toLocaleDateString() : 'Ejet',
            },
        ],
        []
    )

    const selectionModel: GridRowSelectionModel = useMemo(
        () => ({ type: 'include' as const, ids: new Set<number>(selectedVehicleIds) }),
        [selectedVehicleIds]
    )

    const handleSelectionChange = (model: GridRowSelectionModel) => {
        onSelectionChange(Array.from(model.ids) as number[])
    }

    return (
        <Card sx={{ p: 3 }}>
            <Typography variant="subtitle2" color="text.primary" sx={{ mb: 0.5 }}>
                Vælg køretøjer til simulering
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                Marker de køretøjer der skal indgå i simuleringen. Køretøjer med manglende metadata kan ikke vælges.
            </Typography>
            {onDownload && (
                <div className="flex justify-end mb-1">
                    <Button onClick={onDownload} startIcon={<DownloadIcon />} size="small" variant="outlined">
                        Download dataperiode
                    </Button>
                </div>
            )}
            <DataGrid
                rows={vehicles}
                columns={columns}
                getRowId={(row) => row.id}
                density="compact"
                loading={isLoading}
                checkboxSelection
                disableColumnResize
                disableColumnSelector
                rowSelectionModel={selectionModel}
                onRowSelectionModelChange={handleSelectionChange}
                isRowSelectable={(params) => params.row.status !== 'dataMissing'}
                initialState={{
                    pagination: { paginationModel: { pageSize: 20 } },
                    sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
                }}
                pageSizeOptions={[10, 20, 50]}
                localeText={{
                    ...daDK.components.MuiDataGrid.defaultProps.localeText,
                    paginationRowsPerPage: 'Rækker per side:',
                    paginationDisplayedRows: ({ from, to, count }) => `${from}–${to} af ${count}`,
                }}
                slots={{
                    baseCheckbox: RoundedCheckbox,
                }}
                sx={{
                    mt: 1,
                    cursor: 'pointer',
                    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                        outline: 'none',
                    },
                    '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
                        outline: 'none',
                    },
                }}
            />
            <div className="flex gap-2 mt-3 justify-end">
                <Button
                    disabled={simulationDisabled}
                    onClick={() => router.push('/fleet')}
                    startIcon={<DirectionsCarIcon />}
                    variant="outlined"
                    size="small"
                >
                    Manuel simulering
                </Button>
                <Button
                    disabled={simulationDisabled}
                    startIcon={<MemoryIcon />}
                    onClick={async () => {
                        await dispatch(prepareGoalSimulation())
                        router.push('/goal')
                    }}
                    variant="outlined"
                    size="small"
                >
                    Automatisk simulering
                </Button>
            </div>
        </Card>
    )
}
