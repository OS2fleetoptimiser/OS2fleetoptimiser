import { Button, Menu } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import utc from 'dayjs/plugin/utc';
import { AiOutlineArrowDown } from 'react-icons/ai';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

dayjs.extend(utc);

type props = {
    start: Dayjs;
    end: Dayjs;
    setStart: (start: Dayjs) => void;
    setEnd: (start: Dayjs) => void;
};

export default function DateFilter({ end, setEnd, setStart, start }: props) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Button
                variant="outlined"
                size="small"
                onClick={handleClick}
                endIcon={<KeyboardArrowDownIcon />}
            >
                Periode: {start.format('DD-MM-YYYY')} - {end.format('DD-MM-YYYY')}
            </Button>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
            >
                <div className="flex flex-col items-center p-2">
                    <DatePicker
                        className="w-full"
                        value={start}
                        onChange={(e) => {
                            if (e) {
                                setStart(e);
                            }
                        }}
                        label="Fra"
                    />
                    <AiOutlineArrowDown />
                    <DatePicker
                        className="w-full"
                        value={end}
                        onChange={(e) => {
                            if (e) {
                                setEnd(e);
                            }
                        }}
                        label="Til"
                    />
                </div>
            </Menu>
        </>
    );
}
