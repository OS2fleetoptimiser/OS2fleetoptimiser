'use client';

import { InfoOutlined } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';

const ToolTip = ({ children }: { children: string }) => (
    <Tooltip placement="right" title={children}>
        <IconButton>
            <InfoOutlined fontSize="small" />
        </IconButton>
    </Tooltip>
);
export default ToolTip;
