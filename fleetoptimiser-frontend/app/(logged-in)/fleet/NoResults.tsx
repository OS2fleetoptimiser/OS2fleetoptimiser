import TaxiAlertIcon from '@mui/icons-material/TaxiAlert';
import Box from '@mui/material/Box';

const NoSimulationResults = () => {
    return (
        <Box className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl bg-white" sx={{ border: '1px solid', borderColor: 'divider' }}>
            <div className="pt-1">
                <TaxiAlertIcon className="text-gray-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er ingen resultater endnu.
                <br />
                <span className="text-red-500 font-semibold">Gå til opsætning</span> og start en simulering/optimering.
            </div>
        </Box>
    );
};

export default NoSimulationResults;
