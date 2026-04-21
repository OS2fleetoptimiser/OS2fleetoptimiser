import { ToggleButtonGroup, styled } from '@mui/material';

export const SegmentedControl = styled(ToggleButtonGroup)(({ theme }) => ({
    backgroundColor: theme.palette.grey[100],
    borderRadius: '999px',
    padding: '3px',
    gap: '2px',
    boxShadow: 'none',
    '& .MuiToggleButton-root': {
        border: 'none',
        borderRadius: '999px !important',
        padding: '5px 12px',
        textTransform: 'none',
        fontWeight: 500,
        color: theme.palette.text.secondary,
        transition: 'background-color 150ms, color 150ms, box-shadow 150ms',
        '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.04)',
        },
        '&.Mui-selected': {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)',
            '&:hover': {
                backgroundColor: theme.palette.background.paper,
            },
        },
        '&.Mui-disabled': {
            border: 'none',
        },
    },
}));
