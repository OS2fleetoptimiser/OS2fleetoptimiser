import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import EmptyState from '@/components/EmptyState';

const NoSimulations = () => {
    return (
        <EmptyState icon={<ReportGmailerrorredIcon color="action" fontSize="large" />}>
            Der er ikke blevet foretaget nogen simuleringer den seneste måned i organisationen.
            <br />
            Spring videre til Simulering for at komme i gang og for at se højdepunkter her.
        </EmptyState>
    );
};

export default NoSimulations;
