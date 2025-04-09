import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

export const DatesWidget = ({ startDate, endDate, manualSimulation = true }: { startDate: string; endDate: string; manualSimulation: boolean }) => {
    return (
        <div className="flex flex-col text-sm">
            <div className="flex font-bold text-black items-center">
                <CalendarTodayOutlinedIcon fontSize="small" className="text-gray-500 mr-2" />
                {`${manualSimulation ? 'Simulerings' : 'Optimerings'}periode`}
            </div>
            <div className="flex flex-row space-x-1 mt-1 text-gray-500 ml-1">{`${startDate} - ${endDate}`}</div>
        </div>
    );
};
