import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

export const LocationsWidget = ({ locations }: { locations: string[] }) => {
    return (
        <div className="flex flex-col text-sm mb-2">
            <div className="flex font-bold text-black items-center">
                <HomeOutlinedIcon fontSize="small" className="text-gray-500 mr-2" />
                Lokationer
            </div>
            <div className="flex flex-row space-x-1 mt-1 text-gray-500 ml-1">{locations.join(', ')}</div>
        </div>
    );
};
