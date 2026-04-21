import TaxiAlertIcon from '@mui/icons-material/TaxiAlert';
import EmptyState from '@/components/EmptyState';

const NoSimulationResults = () => {
    return (
        <EmptyState icon={<TaxiAlertIcon color="action" fontSize="large" />}>
            Der er ingen resultater endnu.
            <br />
            Gå til opsætning og start en simulering/optimering.
        </EmptyState>
    );
};

export default NoSimulationResults;
