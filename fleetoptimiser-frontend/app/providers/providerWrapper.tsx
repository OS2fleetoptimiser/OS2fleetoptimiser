'use client';

import store from '@/components/redux/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Provider } from 'react-redux';
import 'dayjs/locale/da';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import ValueCheckProvider from './ValueCheckProvider';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';

dayjs.locale('da');
dayjs.extend(weekday);

const queryClient = new QueryClient();

const ProviderWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="da">
            <Provider store={store}>
                <QueryClientProvider client={queryClient}>
                    <ValueCheckProvider />
                    {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
                    {children}
                </QueryClientProvider>
            </Provider>
        </LocalizationProvider>
    );
};

export default ProviderWrapper;
