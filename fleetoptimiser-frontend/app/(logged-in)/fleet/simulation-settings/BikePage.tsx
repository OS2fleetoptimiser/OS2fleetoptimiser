import BikeForm from '@/components/BikeSettingsForm';
import { useAppSelector } from '@/components/redux/hooks';

export const BikePage = () => {
    const bikeSettings = useAppSelector((state) => state.simulation.settings.bike_settings);

    return (
        <BikeForm
            maxTripDistance={bikeSettings.max_km_pr_trip}
            percentTaken={bikeSettings.percentage_of_trips}
            bikeIntervals={bikeSettings.bike_slots.map((slot) => ({
                start: slot.bike_start,
                end: slot.bike_end,
            }))}
            bikeSpeed={bikeSettings.bike_speed}
            electricalBikeSpeed={bikeSettings.electrical_bike_speed}
        />
    );
};
