import { Typography } from '@mui/material';
import { ShiftForm } from '@/components/ShiftSettingsForm';
import { useAppSelector } from '@/components/redux/hooks';
import { shift_settings } from '@/components/hooks/useGetSettings';

export const ShiftsPage = () => {
    const locationIds = useAppSelector((state) => state.simulation.location_ids);
    const locationAddresses = useAppSelector((state) => state.simulation.locationIdAddresses);
    const locationShiftSettings = useAppSelector((state) => {
        const { location_ids, settings } = state.simulation;
        return (location_ids || []).reduce((acc: Record<number, shift_settings>, locId) => {
            const shiftSetting = settings.shift_settings.find((s) => s.location_id === locId);
            acc[locId] = shiftSetting || { location_id: locId, shifts: [], address: '' };
            return acc;
        }, {});
    });

    if (!locationIds || locationIds.length === 0) return null;

    return (
        <div className="space-y-4">
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Vagtlag bestemmer, hvornår køretøjer er tilgængelige i simuleringen. Alle valgte lokationer skal have ens vagtlag for at kunne simulere.
            </Typography>
            {locationIds.map((locId) => {
                const address = locationAddresses?.find((l) => l.id === locId)?.address;
                return (
                    <ShiftForm
                        key={'ShiftFormKey' + locId}
                        locationId={locationShiftSettings[locId].location_id}
                        shifts={locationShiftSettings[locId].shifts}
                        addressName={address || locationShiftSettings[locId].address}
                    />
                );
            })}
        </div>
    );
};
