import TaxiAlertIcon from '@mui/icons-material/TaxiAlert';
import { Card, Typography } from '@mui/material';

const NoSelectableVehicles = () => {
    return (
        <Card sx={{ p: 3, maxWidth: 480 }} className="flex items-start space-x-4">
            <div className="pt-0.5">
                <TaxiAlertIcon color="disabled" fontSize="large" />
            </div>
            <div>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Der er ingen køretøjer på de valgte lokationer i den valgte periode.
                </Typography>
                <Typography variant="body2" color="error" sx={{ fontWeight: 600, mt: 0.5 }}>
                    Juster lokation eller dato for at komme i gang.
                </Typography>
            </div>
        </Card>
    );
};

export default NoSelectableVehicles;