import RemoveRoadIcon from '@mui/icons-material/RemoveRoad';
import EmptyState from '@/components/EmptyState';

const NoData = () => {
    return (
        <EmptyState icon={<RemoveRoadIcon color="error" fontSize="large" />}>
            Der er intet data at vise for den seneste måned.
        </EmptyState>
    );
};

export default NoData;
