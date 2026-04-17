'use client';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';

const ToolTip = ({ children }: { children: string }) => (
    <Tooltip placement="right" title={children}>
        <InfoOutlinedIcon
            sx={{
                fontSize: 18,
                color: 'text.secondary',
                cursor: 'pointer',
                verticalAlign: 'middle',
                transition: 'color 150ms',
                '&:hover': { color: 'text.primary' },
            }}
        />
    </Tooltip>
);
export default ToolTip;
