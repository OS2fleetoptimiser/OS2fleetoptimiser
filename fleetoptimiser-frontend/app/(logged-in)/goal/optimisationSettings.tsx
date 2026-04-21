'use client';

import { setexpenseEmissionPrioritisation } from '@/components/redux/SimulationSlice';
import { useAppDispatch, useAppSelector } from '@/components/redux/hooks';
import { Box, Slider, Typography } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import RecyclingIcon from '@mui/icons-material/Recycling';
import { green } from '@/theme/themePrimitives';

const OptimisationSettings = () => {
    const dispatch = useAppDispatch();
    const value = useAppSelector((state) => state.simulation.goalSimulationSettings.expenseEmissionPrioritisation);

    const co2Pct = value * 10;
    const costPct = (10 - value) * 10;

    return (
        <Box sx={{ px: 2.5, py: 2 }}>
            <Typography variant="subtitle2" color="text.primary">
                Prioritering
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 2, lineHeight: 1.5 }}>
                Juster vægtningen mellem omkostning og CO2e-udledning for at guide algoritmen i valg af løsninger.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2, bgcolor: 'grey.50', borderRadius: 1, py: 0.75, mx: 'auto', width: 'fit-content', px: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {costPct}% Omkostning
                </Typography>
                <Typography variant="caption" color="text.disabled">|</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: green[500] }}>
                    {co2Pct}% CO2e
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
                <AttachMoneyIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                <Slider
                    value={value}
                    onChange={(e, v) => {
                        if (typeof v === 'number') dispatch(setexpenseEmissionPrioritisation(v));
                    }}
                    track={false}
                    step={1}
                    min={0}
                    max={10}
                />
                <RecyclingIcon sx={{ fontSize: 20, color: green[500] }} />
            </Box>
        </Box>
    );
};

export default OptimisationSettings;
