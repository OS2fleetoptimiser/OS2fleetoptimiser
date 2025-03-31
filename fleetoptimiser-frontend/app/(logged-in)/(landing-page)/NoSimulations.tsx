import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

const NoSimulations = () => {
    return (
        <div className="flex items-start space-x-4 w-full max-w-md p-5 mb-10 rounded-2xl shadow-lg bg-white border border-red-100">
            <div className="pt-1">
                <ReportGmailerrorredIcon className="text-gray-500" fontSize="large" />
            </div>
            <div className="text-gray-700 font-medium leading-relaxed">
                Der er ikke blevet foretaget nogen simuleringer den seneste måned i organisationen. <br />
                <span className="text-red-500 font-semibold">Spring videre til Simulering</span> for at komme i gang og for at se højdepunkter her.
            </div>
        </div>
    );
};

export default NoSimulations;
