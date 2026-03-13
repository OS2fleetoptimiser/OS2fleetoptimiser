import GoalSimulationHandler from '@/app/(logged-in)/goal/GoalSimulationHandler';
import PageTitle from '@/components/PageTitle';

export default function Page() {
    return (
        <>
            <PageTitle
                title="Automatisk simulering"
                subtitle="Anmod AI-modulet om forslag til optimerede flådesammensætninger baseret på den valgte konfiguration."
            />
            <GoalSimulationHandler />
        </>
    );
}
