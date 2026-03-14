import RemoveRoadIcon from '@mui/icons-material/RemoveRoad';
import Box from '@mui/material/Box';

const NoData = () => {
    return (
        <Box className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl bg-white" sx={{ border: '1px solid', borderColor: 'divider' }}>
            <div className="pt-1">
                <RemoveRoadIcon className="text-red-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er intet data at vise for den seneste måned.<br />
            </div>
        </Box>
    );
};

export default NoData;
