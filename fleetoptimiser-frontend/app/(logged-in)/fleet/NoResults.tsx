import TaxiAlertIcon from '@mui/icons-material/TaxiAlert';

const NoSimulationResults = () => {
    return (
        <div className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl shadow-lg bg-white border">
            <div className="pt-1">
                <TaxiAlertIcon className="text-gray-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er ingen resultater endnu.
                <br />
                <span className="text-red-500 font-semibold">Gå til opsætning</span> og start en simulering/optimering.
            </div>
        </div>
    );
};

export default NoSimulationResults;
