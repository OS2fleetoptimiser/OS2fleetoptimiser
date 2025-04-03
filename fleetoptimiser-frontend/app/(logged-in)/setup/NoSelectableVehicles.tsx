import TaxiAlertIcon from '@mui/icons-material/TaxiAlert';

const NoSelectableVehicles = () => {
    return (
        <div className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl shadow-lg bg-white border">
            <div className="pt-1">
                <TaxiAlertIcon className="text-gray-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er ingen køretøjer på de valgte lokationer i den valgte periode. <br />
                <span className="text-red-500 font-semibold">Justér lokation eller dato</span> for at komme i gang.
            </div>
        </div>
    );
};

export default NoSelectableVehicles;