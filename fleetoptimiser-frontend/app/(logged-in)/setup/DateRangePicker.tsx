import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';
import { da } from 'date-fns/locale';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Box, Button } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import {useMediaQuery} from "react-responsive";

export interface DateRangeType {
    startDate: Dayjs;
    endDate: Dayjs;
    key: string;
}

interface DateRangePickerProps {
    range: DateRangeType[];
    onChange: (range: DateRangeType) => void;
}

export const DateRangePicker = ({ range, onChange }: DateRangePickerProps) => {
    const isSmallScreen = useMediaQuery({ maxWidth: '950px' });  // at < 950px the datepicker will overflow width

    const today = new Date()
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const [open, setOpen] = useState(false);
    const [tempRange, setTempRange] = useState<DateRangeType>(range[0]);

    const handleSelect = (ranges: RangeKeyDict) => {
        const selection = ranges.selection;
        setTempRange({
            startDate: dayjs(selection.startDate),
            endDate: dayjs(selection.endDate),
            key: selection.key,
        });
    };
    const handleOk = () => {
        onChange(tempRange);
        setOpen(false);
    };

    return (
        <div className="w-64 z-10 rounded-lg bg-white">
            <label className="block mb-2 text-lg font-semibold text-black">Vælg simuleringsperiode</label>
            <Box className="rounded-lg px-4 py-2 cursor-pointer text-sm bg-white" sx={{ border: '1px solid', borderColor: 'divider' }} onClick={() => setOpen(!open)}>
                {range[0].startDate?.toDate().toLocaleDateString('da-DK')} - {range[0].endDate?.toDate().toLocaleDateString('da-DK')}
            </Box>

            {open && (
                <div className="absolute border shadow-md z-10 mt-2 rounded-lg bg-white overflow-auto max-h-[80vh]">
                    <div className="flex justify-end mr-2 mt-2 cursor-pointer">
                        <CloseIcon onClick={() => setOpen(false)} fontSize="small" className="text-gray-500 hover:text-black" />
                    </div>
                    <DateRange
                        ranges={[
                            {
                                startDate: tempRange.startDate.toDate(),
                                endDate: tempRange.endDate.toDate(),
                                key: tempRange.key,
                            },
                        ]}
                        onChange={handleSelect}
                        locale={da}
                        maxDate={today}
                        minDate={fiveYearsAgo}
                        moveRangeOnFirstSelection={false}
                        months={isSmallScreen ? 1 : 2}
                        direction={isSmallScreen ? 'vertical' : 'horizontal'}
                        rangeColors={['#224bb4']}
                        weekdayDisplayFormat="EE"
                        showDateDisplay={false}
                    />
                    <div className="flex justify-end p-1 space-x-2 mb-1 mr-1">
                        <Button onClick={() => setOpen(false)} variant="outlined">
                            Luk
                        </Button>
                        <Button onClick={handleOk} variant="contained">
                            Bekræft
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
