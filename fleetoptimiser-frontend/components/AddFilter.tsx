'use client';
import { Box, Typography } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

const AddFilter = () => {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                gap: 1.5,
            }}
        >
            <FilterListIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
                Vælg et filter for at se data
            </Typography>
        </Box>
    );
};

export default AddFilter;
