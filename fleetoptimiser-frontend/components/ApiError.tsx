import { Button } from '@mui/material';
import { MdOutlineWifiOff } from 'react-icons/md';

type props = {
    children: string;
    retryFunction: () => void;
};

const ApiError = ({ children, retryFunction }: props) => {
    return (
        <div className="flex flex-col justify-center items-center">
            <MdOutlineWifiOff size={80} />
            <p>{children}</p>
            <Button onClick={retryFunction}>Prøv igen</Button>
        </div>
    );
};

export default ApiError;
