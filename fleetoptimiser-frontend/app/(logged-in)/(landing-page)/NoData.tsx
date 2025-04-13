import RemoveRoadIcon from '@mui/icons-material/RemoveRoad';

const NoData = () => {
    return (
        <div className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl shadow-sm bg-white border border-gray-100">
            <div className="pt-1">
                <RemoveRoadIcon className="text-red-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er intet data at vise for den seneste måned.<br />
            </div>
        </div>
    );
};

export default NoData;
