import WifiOffIcon from '@mui/icons-material/WifiOff';
import { Card, Typography } from '@mui/material';

const NoConnectionError = () => {
    return (
        <Card sx={{ p: 3, maxWidth: 480 }} className="flex items-start space-x-4">
            <div className="pt-0.5">
                <WifiOffIcon color="error" fontSize="large" />
            </div>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                Beklager, vi kunne ikke hente data - der er ingen forbindelse til serveren. Prøv igen senere eller kontakt support.
            </Typography>
        </Card>
    );
};

export default NoConnectionError