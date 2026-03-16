'use client';

import { useMemo } from 'react';
import UpdateIcon from '@mui/icons-material/Update';
import { AllowedStart, ExtendedLocationInformation } from '@/components/hooks/useGetLocationPrecision';
import { useRouter } from 'next/navigation';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';

type Props = {
  data?: ExtendedLocationInformation[];
};

const successThreshold = 80;

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
          const color =
            value >= successThreshold
              ? theme.palette.success.main
              : value === 0
                ? undefined
                : theme.palette.error.main;
          return (
            <span style={{ fontWeight: 700, color }}>
              {Math.round(value)}%
            </span>
          );
        },
      },
    ],
    [compareDate, theme]
  );

  const rows = useMemo(
    () => (data ? [...data].sort((a, b) => a.address.localeCompare(b.address)) : []),
    [data]
  );

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
      sx={{ mt: 2, cursor: 'pointer' }}
    />
  );
};
