import { useMemo, forwardRef } from 'react'
import { Checkbox } from '@mui/material'
import {
    DataGrid,
    GridColDef,
    GridRenderCellParams,
    GridRowSelectionModel,
} from '@mui/x-data-grid'
import { daDK } from '@mui/x-data-grid/locales'
import { Vehicle } from '@/components/hooks/useGetVehicles'
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks'
import {
    addExtraVehicle,
    addTestVehicle,
    addTestVehicleMeta,
    removeExtraVehicle,
    removeTestVehicle,
    removeTestVehicleMeta,
} from '@/components/redux/SimulationSlice'
import { BpIcon, BpCheckedIcon } from '@/app/(logged-in)/setup/CheckBoxIcons'

const RoundedCheckbox = forwardRef<HTMLButtonElement, any>((props, ref) => (
    <Checkbox
        ref={ref}
        {...props}
        icon={<BpIcon />}
        checkedIcon={<BpCheckedIcon />}
    />
))

const ExtraVehicleTable = ({ cars }: { cars: Vehicle[] }) => {
    const dispatch = useAppDispatch()
    const extraVehicles = useAppSelector(
        (state) => state.simulation.fleetSimulationSettings.extraVehicles
    )

    const selectionModel: GridRowSelectionModel = useMemo(
        () => ({
            type: 'include' as const,
            ids: new Set<number>(extraVehicles.map((v) => v.id)),
        }),
        [extraVehicles]
    )

    const handleSelectionChange = (newModel: GridRowSelectionModel) => {
        const newIds = new Set(newModel.ids)
        const oldIds = new Set(extraVehicles.map((v) => v.id))

        for (const id of newIds) {
            if (!oldIds.has(id as number)) {
                const vehicle = cars.find((c) => c.id === id)
                if (vehicle) {
                    dispatch(addExtraVehicle(vehicle))
                    dispatch(addTestVehicle(vehicle.id))
                    dispatch(addTestVehicleMeta(vehicle))
                }
            }
        }

        for (const id of oldIds) {
            if (!newIds.has(id)) {
                const vehicle = cars.find((c) => c.id === id)
                if (vehicle) {
                    dispatch(removeExtraVehicle(vehicle))
                    dispatch(removeTestVehicle(vehicle.id))
                    dispatch(removeTestVehicleMeta(vehicle))
                }
            }
        }
    }

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: 'name',
                headerName: 'Biltype',
                flex: 1.5,
                minWidth: 200,
                valueGetter: (_value: unknown, row: Vehicle) =>
                    `${row.make} ${row.model}`,
            },
            {
                field: 'wltp',
                headerName: 'Drivmiddel forbrug',
                flex: 0.8,
                minWidth: 140,
                valueGetter: (_value: unknown, row: Vehicle) => {
                    if (row.wltp_el) return row.wltp_el
                    if (row.wltp_fossil) return row.wltp_fossil
                    return null
                },
                renderCell: (params: GridRenderCellParams) => {
                    const vehicle = params.row as Vehicle
                    if (vehicle.wltp_el)
                        return `${vehicle.wltp_el} Wh/km`
                    if (vehicle.wltp_fossil)
                        return `${vehicle.wltp_fossil} km/l`
                    return 'Ikke udfyldt'
                },
            },
            {
                field: 'omkostning_aar',
                headerName: 'Årlige omkostninger (DKK)',
                type: 'number',
                flex: 0.8,
                minWidth: 180,
                valueFormatter: (value: number | null) =>
                    value ? value.toLocaleString() : '-',
            },
        ],
        []
    )

    return (
        <DataGrid
            rows={cars}
            columns={columns}
            getRowId={(row) => row.id}
            density="compact"
            checkboxSelection
            disableColumnResize
            disableColumnSelector
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={handleSelectionChange}
            initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
                sorting: {
                    sortModel: [
                        { field: 'omkostning_aar', sort: 'asc' },
                    ],
                },
            }}
            pageSizeOptions={[10, 20, 50]}
            localeText={{
                ...daDK.components.MuiDataGrid.defaultProps.localeText,
                paginationRowsPerPage: 'Rækker per side:',
                paginationDisplayedRows: ({ from, to, count }) =>
                    `${from}\u2013${to} af ${count}`,
            }}
            slots={{
                baseCheckbox: RoundedCheckbox,
            }}
            sx={{
                my: 2,
                '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within':
                    { outline: 'none' },
                '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within':
                    { outline: 'none' },
            }}
        />
    )
}

export default ExtraVehicleTable
