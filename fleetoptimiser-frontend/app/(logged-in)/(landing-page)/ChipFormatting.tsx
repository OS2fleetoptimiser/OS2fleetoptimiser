import { Chip } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import BlockIcon from '@mui/icons-material/Block';
import MemoryIcon from '@mui/icons-material/Memory';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

export const FleetChangeChip = (fleetChange: number) => {
  return (
    <Chip
      label={Math.abs(fleetChange)}
      color={fleetChange === 0 ? 'default' : fleetChange > 0 ? 'success' : 'error'}
      icon={
        fleetChange === 0 ? undefined : fleetChange > 0 ? (
          <ArrowDownwardIcon sx={{ fontSize: 14, transform: 'rotate(180deg)' }} />
        ) : (
          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
        )
      }
    />
  );
};

export const PlusMinusChip = (value: number, extraLabel?: string) => {
  return (
    <Chip
      label={`${Math.abs(value).toLocaleString()}${extraLabel ? ' ' + extraLabel : ''}`}
      color={value === 0 ? 'default' : value > 0 ? 'success' : 'error'}
      icon={
        value === 0 ? undefined : value > 0 ? (
          <AddIcon sx={{ fontSize: 14 }} />
        ) : (
          <RemoveIcon sx={{ fontSize: 14 }} />
        )
      }
    />
  );
};

export const UnallocatedChip = (value: number) => {
  return (
    <Chip
      label={value}
      color={value === 0 ? 'success' : 'error'}
      icon={
        value === 0 ? (
          <TaskAltIcon sx={{ fontSize: 14 }} />
        ) : (
          <BlockIcon sx={{ fontSize: 14 }} />
        )
      }
    />
  );
};

export const SimTypeChip = (simulationType: 'goal' | 'fleet') => {
  return (
    <>
      {simulationType === 'goal' && (
        <Chip
          icon={<MemoryIcon />}
          color="info"
          label="Automatisk"
        />
      )}
      {simulationType === 'fleet' && (
        <Chip
          icon={<DirectionsCarIcon />}
          color="default"
          label="Manuel"
        />
      )}
    </>
  );
};
