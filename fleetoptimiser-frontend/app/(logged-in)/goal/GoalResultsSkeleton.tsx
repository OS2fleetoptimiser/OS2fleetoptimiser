import { Skeleton } from '@mui/material';

const GoalResultSkeletons = () => {
    return (
        <>
            <div className="flex justify-between mb-2">
                <Skeleton variant="rectangular" className="flex-1 drop-shadow-md mr-2 h-24"></Skeleton>
                <Skeleton variant="rectangular" className="flex-1 drop-shadow-md h-24"></Skeleton>
            </div>
            <Skeleton variant="rectangular" className="flex-1 drop-shadow-md h-80"></Skeleton>
            <Skeleton variant="rectangular" className="flex-1 drop-shadow-md h-80"></Skeleton>
            <Skeleton variant="rectangular" className="drop-shadow-md h-56"></Skeleton>
        </>
    );
};

export default GoalResultSkeletons;
