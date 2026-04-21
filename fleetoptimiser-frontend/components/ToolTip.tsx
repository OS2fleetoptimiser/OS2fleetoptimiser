'use client';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton, Tooltip } from '@mui/material';

const ToolTip = ({ children }: { children: string }) => (
    <Tooltip placement="right" title={children}>
        <IconButton size="small" aria-label={children} sx={{ color: 'text.secondary' }}>
            <InfoOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
    </Tooltip>
);
export default ToolTip;
