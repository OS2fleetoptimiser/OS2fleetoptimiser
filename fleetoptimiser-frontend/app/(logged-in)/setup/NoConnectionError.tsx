import WifiOffIcon from '@mui/icons-material/WifiOff';
import EmptyState from '@/components/EmptyState';

const NoConnectionError = () => {
    return (
        <EmptyState icon={<WifiOffIcon color="error" fontSize="large" />}>
            Beklager, vi kunne ikke hente data - der er ingen forbindelse til serveren. Prøv igen senere eller kontakt support.
        </EmptyState>
    );
};

export default NoConnectionError;
