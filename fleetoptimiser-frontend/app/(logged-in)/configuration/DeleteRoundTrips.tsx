import ApiError from '@/components/ApiError';
import API from '@/components/AxiosBase';
import ToolTip from '@/components/ToolTip';
import { Button, Dialog, DialogContent, DialogTitle, Skeleton, TextField, Typography, Paper } from '@mui/material';
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

    const getSimSettings = useQuery({
        queryKey: ['settings'],

        queryFn: async () => {
            const result = await API.get<{
                simulation_settings: {
                    keep_data: number;
                };
            }>('configuration/simulation-configurations');
            setKeepData(result.data.simulation_settings.keep_data);
            return result.data;
        }
    });
    const getStatistics = useQuery({
        queryKey: ['statistics'],

        queryFn: async () => {
            const result = await API.get<{
                first_date: string;
                last_date: string;
                total_roundtrips: number;
            }>('/statistics/sum');
            return result.data;
        }
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
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <span className="inline-flex items-center gap-1">
                    Automatisk Tursletning
                    <ToolTip>
                        Vælg hvor mange måneder data skal gemmes i. Som standard gemmes data i 24 måneder. Hver nat vil det data, der overskrider forfaldsdatoen
                        blive slettet.
                    </ToolTip>
                </span>
            </DialogTitle>
            <DialogContent sx={{ '&&': { pt: 1 } }}>
                {getSimSettings.isError ? (
                    <ApiError retryFunction={getSimSettings.refetch}>Data kunne ikke hentes</ApiError>
                ) : getStatistics.isError ? (
                    <ApiError retryFunction={getStatistics.refetch}>Meta Data kunne ikke hentes</ApiError>
                ) : getSimSettings.isPending || getStatistics.isPending ? (
                    <div className="space-y-4">
                        <Skeleton variant="rounded" height={72} />
                        <Skeleton variant="rounded" height={40} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <div className="p-4">
                                <div className="flex justify-between">
                                    <div>
                                        <Typography variant="caption" color="text.secondary">Antal rundture</Typography>
                                        <Typography variant="body2">{getStatistics.data.total_roundtrips}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="caption" color="text.secondary">Start på første rundtur</Typography>
                                        <Typography variant="body2">{dayjs(getStatistics.data.first_date).format('DD-MM-YYYY')}</Typography>
                                    </div>
                                    <div>
                                        <Typography variant="caption" color="text.secondary">Start på sidste rundtur</Typography>
                                        <Typography variant="body2">{dayjs(getStatistics.data.last_date).format('DD-MM-YYYY')}</Typography>
                                    </div>
                                </div>
                            </div>
                        </Paper>
                        <TextField
                            fullWidth
                            size="small"
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
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button variant="text" color="inherit" onClick={onClose}>Annuller</Button>
                <Button variant="contained" color="primary" onClick={handleDelete} loading={loading} loadingPosition="center">
                    <span>Gem</span>
                </Button>
            </DialogActions>

            <Dialog open={showConfirmation} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogTitle>Bekræftelse</DialogTitle>
                <DialogContent sx={{ '&&': { pt: 1 } }}>
                    <Typography variant="body2" color="text.secondary">
                        Bekræft at du vil slette data fra før{' '}
                        {dayjs()
                            .subtract(keepData as number, 'month')
                            .format('DD-MM-YYYY')
                            .toString()}
                        . I alt vil {numberOfAffectedRoundTrips} ture blive slettet og kan ikke genskabes
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button variant="text" color="inherit" onClick={handleClose}>Annuller</Button>
                    <Button variant="contained" color="error" onClick={handleDeleteConfirm}>Slet</Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};
export default DeleteRoundTrips;
