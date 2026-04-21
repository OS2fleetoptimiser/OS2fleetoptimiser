'use client';

import { useMemo } from 'react';
import UpdateIcon from '@mui/icons-material/Update';
import { AllowedStart, ExtendedLocationInformation } from '@/components/hooks/useGetLocationPrecision';
import { useRouter } from 'next/navigation';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { daDK } from '@mui/x-data-grid/locales';
import { PRECISION_THRESHOLD } from '@/app/(logged-in)/location/KeyLocationFigures';

type Props = {
  data?: ExtendedLocationInformation[];
};

function isLocationRecentlyUpdated(location: AllowedStart, compareDate: Date) {
  if (location.addition_date && new Date(location.addition_date) > compareDate) {
    return true;
  }
  if (location.additional_starts && location.additional_starts.length > 0) {
    return location.additional_starts.some((addition) => {
      return addition.addition_date && new Date(addition.addition_date) > compareDate;
    });
  }
  return false;
}

export const LocationPrecisionList = ({ data }: Props) => {
  const router = useRouter();
  const theme = useTheme();
  const compareDate = useMemo(() => dayjs().subtract(1, 'month').toDate(), []);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'address',
        headerName: 'Adresse',
        flex: 1.5,
        minWidth: 150,
      },
      {
        field: 'car_count',
        headerName: 'Antal køretøjer',
        type: 'number',
        flex: 1,
        minWidth: 120,
      },
      {
        field: 'parking_spots',
        headerName: 'Antal parkeringspunkter',
        type: 'number',
        flex: 1,
        minWidth: 120,
        valueGetter: (_value: unknown, row: ExtendedLocationInformation) =>
          1 + (row.additional_starts ? row.additional_starts.length : 0),
        renderCell: (params: GridRenderCellParams) => {
          const location = params.row as ExtendedLocationInformation;
          const recentlyUpdated = isLocationRecentlyUpdated(location, compareDate);
          return (
            <span className="flex items-center justify-end w-full">
              {recentlyUpdated && (
                <Tooltip title="Lokationen er opdateret indenfor den sidste måned med parkeringspunkter. Præcisionen kan derfor stadig ændre sig.">
                  <UpdateIcon className="mr-2" fontSize="small" />
                </Tooltip>
              )}
              {params.value}
            </span>
          );
        },
      },
      {
        field: 'roundtrip_km',
        headerName: 'Kilometer i rundtur',
        type: 'number',
        flex: 1,
        minWidth: 120,
        valueFormatter: (value: number) => `${Math.round(value).toLocaleString()} km`,
      },
      {
        field: 'km',
        headerName: 'Kilometer total',
        type: 'number',
        flex: 1,
        minWidth: 120,
        valueFormatter: (value: number) => `${Math.round(value).toLocaleString()} km`,
      },
      {
        field: 'precision',
        headerName: 'Præcision',
        type: 'number',
        flex: 1,
        minWidth: 100,
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value as number;
          const aboveThreshold = value >= PRECISION_THRESHOLD;
          return (
            <span
              style={{
                fontWeight: 700,
                color: aboveThreshold ? theme.palette.success.main : theme.palette.primary.main,
                opacity: aboveThreshold ? 0.85 : Math.max(0.25, value / 100),
              }}
            >
              {Math.round(value)}%
            </span>
          );
        },
      },
    ],
    [compareDate, theme]
  );

  const rows = data ?? [];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id ?? 0}
      density="compact"
      disableColumnResize
      disableRowSelectionOnClick
      onRowClick={(params) => router.push(`/location/${params.id}`)}
      initialState={{
        pagination: { paginationModel: { pageSize: 20 } },
        sorting: { sortModel: [{ field: 'address', sort: 'asc' }] },
      }}
      pageSizeOptions={[10, 20, 50]}
      localeText={{
        ...daDK.components.MuiDataGrid.defaultProps.localeText,
        paginationRowsPerPage: 'Rækker per side:',
        paginationDisplayedRows: ({ from, to, count }) => `${from}–${to} af ${count}`,
      }}
      sx={{
        cursor: 'pointer',
        '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
          outline: 'none',
        },
        '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
          outline: 'none',
        },
      }}
    />
  );
};
