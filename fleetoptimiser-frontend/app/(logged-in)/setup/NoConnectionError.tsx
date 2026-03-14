import WifiOffIcon from '@mui/icons-material/WifiOff';
import Box from '@mui/material/Box';

const NoConnectionError = () => {
    return (
        <Box className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl bg-white" sx={{ border: '1px solid', borderColor: 'divider' }}>
            <div className="pt-1">
                <WifiOffIcon className="text-red-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Beklager, vi kunne ikke hente data - der er ingen forbindelse til serveren... Prøv igen senere eller kontakt support. <br />
            </div>
        </Box>
    );
};

export default NoConnectionError