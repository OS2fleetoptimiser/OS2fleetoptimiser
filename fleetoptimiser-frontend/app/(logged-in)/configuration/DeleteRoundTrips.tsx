import ApiError from '@/components/ApiError';
import API from '@/components/AxiosBase';
import ToolTip from '@/components/ToolTip';
import { Button, CircularProgress, Dialog, DialogContent, DialogTitle, TextField } from '@mui/material';
import DialogActions from '@mui/material/DialogActions';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import React, { useState } from 'react';
interface DeleteRoundTripsModalProps {
    open: boolean;
    onClose: () => void;
}

const DeleteRoundTrips = ({ open, onClose }: DeleteRoundTripsModalProps) => {
    const [keepData, setKeepData] = useState<number>();
    const [numberOfAffectedRoundTrips, setNumberOfAffectedRoundTrips] = useState<number>();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [startDate] = useState<string>('1970-01-01');

    const getSimSettings = useQuery(['settings'], async () => {
        const result = await API.get<{
            simulation_settings: {
                keep_data: number;
            };
        }>('configuration/simulation-configurations');
        setKeepData(result.data.simulation_settings.keep_data);
        return result.data;
    });
    const getStatistics = useQuery(['statistics'], async () => {
        const result = await API.get<{
            first_date: string;
            last_date: string;
            total_roundtrips: number;
        }>('/statistics/sum');
        return result.data;
    });

    const handleDelete = async () => {
        let endDate;
        if (keepData != null) {
            endDate = dayjs().subtract(keepData, 'month').format('YYYY-MM-DD').toString();
        }
        setLoading(true);
        try {
            const response = await API.get('/statistics/driving-data?start_date=' + startDate + '&end_date=' + endDate + '&shifts=[]');
            if (response.status === 200) {
                if (response.data.driving_data) {
                    setNumberOfAffectedRoundTrips(response.data.driving_data.length);
                } else {
                    setNumberOfAffectedRoundTrips(0);
                }
                setShowConfirmation(true);
                setLoading(false);
            }
        } catch (error: unknown) {
            if (isAxiosError(error) && error.response?.status === 422) {
                setLoading(false);
                console.log('Something went wrong');
            }
        }
    };

    const handleDeleteConfirm = async () => {
        setShowConfirmation(false);
        setLoading(false);
        try {
            const response = await API.patch('configuration/update-configurations', {
                simulation_settings: {
                    keep_data: keepData,
                },
            });
            if (response.status === 200) {
                //TODO evt toast om at det er slettet ?
                onClose();
            }
        } catch (error: unknown) {
            if (isAxiosError(error) && error.response?.status === 422) {
                console.log('Something went wrong');
            }
        }
    };
    const handleClose = () => {
        setShowConfirmation(false);
        setLoading(false);
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle className="border-b font-bold mb-2 pb-2">
                Automatisk Tursletning
                <ToolTip>
                    Vælg hvor mange måneder data skal gemmes i. Som standard gemmes data i 24 måneder. Hver nat vil det data, der overskrider forfaldsdatoen
                    blive slettet.
                </ToolTip>
            </DialogTitle>
            <DialogContent>
                {getSimSettings.isError ? (
                    <ApiError retryFunction={getSimSettings.refetch}>Data kunne ikke hentes</ApiError>
                ) : getStatistics.isError ? (
                    <ApiError retryFunction={getStatistics.refetch}>Meta Data kunne ikke hentes</ApiError>
                ) : getSimSettings.isLoading || getStatistics.isLoading ? (
                    <CircularProgress />
                ) : (
                    <div>
                        <div className="mt-3 font-semibold flex space-x-4 justify-between border-b-2 border-b-black">
                            <h4>Antal rundture</h4>
                            <h4>Start på første rundtur</h4>
                            <h4>Start på sidste rundtur</h4>
                        </div>
                        <div className="mt-3 flex space-x-4 justify-between border-b">
                            <p>{getStatistics.data.total_roundtrips}</p>
                            <p>{dayjs(getStatistics.data.first_date).format('DD-MM-YYYY')}</p>
                            <p>{dayjs(getStatistics.data.last_date).format('DD-MM-YYYY')}</p>
                        </div>
                        <div className="mt-6">
                            <TextField
                                label="Antal måneder data gemmes:"
                                type="number"
                                aria-valuemin={0}
                                aria-valuemax={24}
                                value={keepData}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    const inputValue = parseInt(event.target.value);
                                    if (inputValue > 24) {
                                        setKeepData(24);
                                    } else {
                                        setKeepData(inputValue);
                                    }
                                }}
                                slotProps={{
                                    input: {
                                        inputProps: {
                                            max: 24,
                                            min: 0,
                                        },
                                    },

                                    inputLabel: {
                                        shrink: true,
                                    }
                                }} />
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button size="small" onClick={handleDelete} loading={loading} loadingPosition="center" variant="contained">
                                <span>Gem</span>
                            </Button>
                        </div>
                    </div>
                )}
                {showConfirmation && (
                    <div>
                        <Dialog open={showConfirmation} onClose={handleClose}>
                            <DialogTitle>Bekræftelse</DialogTitle>
                            <DialogContent>
                                <p>
                                    Bekræft at du vil slette data fra før{' '}
                                    {dayjs()
                                        .subtract(keepData as number, 'month')
                                        .format('DD-MM-YYYY')
                                        .toString()}
                                    . I alt vil {numberOfAffectedRoundTrips} ture blive slettet og kan ikke genskabes
                                </p>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleClose}>Cancel</Button>
                                <Button onClick={handleDeleteConfirm} autoFocus>
                                    Delete
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
export default DeleteRoundTrips;
