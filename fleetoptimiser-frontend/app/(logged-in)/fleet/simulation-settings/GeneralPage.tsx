import SettingsForm from '@/components/SimulationSettingsForm';
import { useAppSelector } from '@/components/redux/hooks';

export const GeneralPage = () => {
    const simulationSettings = useAppSelector((state) => state.simulation.settings.simulation_settings);

    return <SettingsForm initialValues={simulationSettings} />;
};
