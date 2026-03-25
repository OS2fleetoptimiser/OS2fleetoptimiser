import { useMemo } from 'react'
import { DataGrid, GridColDef, GridPinnedRowsProp, GridRenderCellParams } from '@mui/x-data-grid'
import { daDK } from '@mui/x-data-grid/locales'
import { Chip } from '@mui/material'
import { ReducedVehicleGroup } from '@/app/(logged-in)/fleet/VehiclesWidget'
import { useAppSelector } from '@/components/redux/hooks'
import { InputVehicleCount } from './InputVehicleCount'
import ToolTip from '@/components/ToolTip'

export const VehiclesSelectionTable = ({
    manualSimulation,
    vehicles,
}: {
    manualSimulation: boolean
    vehicles: ReducedVehicleGroup[]
}) => {
    const name = manualSimulation ? 'simulering' : 'optimering'
    const totalSimulation = useAppSelector((state) =>
        state.simulation.fleetSimulationSettings.simulation_vehicles.reduce(
            (acc, curr) => acc + curr.simulation_count,
            0
        )
    )
    const totalCurrent = useAppSelector((state) => state.simulation.selectedVehicles.length)

    const pinnedRows: GridPinnedRowsProp = useMemo(
        () => ({
            bottom: [
                {
                    vehicle: { id: '__total__', make: '', model: '' },
                    count: totalCurrent,
                    groupIds: [],
                    extra: false,
                    _isTotal: true,
                    _totalSimulation: totalSimulation,
                },
            ],
        }),
        [totalCurrent, totalSimulation]
    )
    const automaticToolText =
        'Hvis du fjerner køretøjer, kan algoritmen erstatte dem med andre testkøretøjer for at finde det bedste mix. Hvis du beholder dem, vil algoritmen forsøge at reducere antallet ved overkapacitet. Dvs. den vil ikke forsøge at udskifte dem med andre testkøretøjer.'

    const columns: GridColDef[] = useMemo(() => {
        const cols: GridColDef[] = [
            {
                field: 'name',
                headerName: 'Køretøj',
                flex: 1.5,
                minWidth: 200,
                valueGetter: (_value: unknown, row: any) =>
                    row._isTotal
                        ? 'Total'
                        : `${row.vehicle.make} ${row.vehicle.model}`,
                renderCell: (params: GridRenderCellParams) => {
                    if ((params.row as any)._isTotal) {
                        return <strong>{params.value}</strong>
                    }
                    if ((params.row as ReducedVehicleGroup).extra) {
                        return (
                            <div className="flex items-center gap-1.5">
                                <span>{params.value}</span>
                                <Chip size="small" color="info" label="Tilføjet" />
                            </div>
                        )
                    }
                    return params.value
                },
            },
            {
                field: 'wltp',
                headerName: 'WLTP',
                flex: 0.7,
                minWidth: 120,
                valueGetter: (_value: unknown, row: ReducedVehicleGroup) => {
                    if (row.vehicle.wltp_el) return row.vehicle.wltp_el
                    if (row.vehicle.wltp_fossil) return row.vehicle.wltp_fossil
                    return null
                },
                renderCell: (params: GridRenderCellParams) => {
                    const vehicle = (params.row as ReducedVehicleGroup).vehicle
                    if (vehicle.wltp_el)
                        return `${vehicle.wltp_el.toLocaleString()} Wh/km`
                    if (vehicle.wltp_fossil)
                        return `${vehicle.wltp_fossil.toLocaleString()} km/l`
                    return 'Intet drivmiddel'
                },
            },
            {
                field: 'omkostning_aar',
                headerName: 'Omkostning / år',
                type: 'number',
                flex: 0.7,
                minWidth: 130,
                valueGetter: (_value: unknown, row: ReducedVehicleGroup) =>
                    row.vehicle.omkostning_aar,
                valueFormatter: (value: number | null) =>
                    value ? value.toLocaleString() : '-',
            },
            {
                field: 'simulation_count',
                headerName: `Antal i ${name}`,
                flex: 0.8,
                minWidth: 150,
                sortable: false,
                filterable: false,
                renderHeader: () => (
                    <div className="flex items-center gap-1">
                        <span className="font-medium">
                            Antal i {name}
                        </span>
                        {!manualSimulation && (
                            <ToolTip>{automaticToolText}</ToolTip>
                        )}
                    </div>
                ),
                renderCell: (params: GridRenderCellParams) =>
                    (params.row as any)._isTotal ? (
                        <strong>{(params.row as any)._totalSimulation}</strong>
                    ) : (
                        <InputVehicleCount
                            reducedVehicleGroup={
                                params.row as ReducedVehicleGroup
                            }
                            restrict={!manualSimulation}
                        />
                    ),
            },
            {
                field: 'count',
                headerName: 'Antal i nuværende flåde',
                type: 'number',
                flex: 0.7,
                minWidth: 170,
                renderCell: (params: GridRenderCellParams) =>
                    (params.row as any)._isTotal ? (
                        <strong>{params.value}</strong>
                    ) : (
                        params.value
                    ),
            },
        ]

        if (!manualSimulation) {
            cols.push({
                field: 'end_leasing',
                headerName: 'Slut leasing',
                flex: 0.7,
                minWidth: 110,
                valueGetter: (_value: unknown, row: ReducedVehicleGroup) =>
                    row.vehicle.end_leasing,
                valueFormatter: (value: string | null) =>
                    value ? new Date(value).toLocaleDateString() : 'Ejet',
            })
        }

        return cols
    }, [manualSimulation, name])

    return (
        <DataGrid
            rows={vehicles}
            columns={columns}
            pinnedRows={pinnedRows}
            getRowId={(row) => row.vehicle.id}
            density="compact"
            disableColumnResize
            disableColumnSelector
            disableRowSelectionOnClick
            initialState={{
                pagination: { paginationModel: { pageSize: 20 } },
                sorting: {
                    sortModel: [{ field: 'name', sort: 'asc' }],
                },
            }}
            pageSizeOptions={[10, 20, 50]}
            localeText={{
                ...daDK.components.MuiDataGrid.defaultProps.localeText,
                paginationRowsPerPage: 'Rækker per side:',
                paginationDisplayedRows: ({ from, to, count }) =>
                    `${from}\u2013${to} af ${count}`,
            }}
            getRowClassName={(params) =>
                (params.row as ReducedVehicleGroup).extra
                    ? 'extra-vehicle-row'
                    : ''
            }
            sx={{
                mt: 1,
                '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within':
                    { outline: 'none' },
                '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within':
                    { outline: 'none' },
                '& .extra-vehicle-row': {
                    backgroundColor: 'hsl(210, 100%, 97%)',
                },
            }}
        />
    )
}
