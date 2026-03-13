'use client';

import FleetSimulationHandler from "@/app/(logged-in)/fleet/FleetSimulationHandler";
import PageTitle from '@/components/PageTitle';

export default function Page() {
    return (
        <>
            <PageTitle
                title="Manuel simulering"
                subtitle="Undersøg indflydelsen af at tilføje eller fjerne køretøjer i flåden. Ændringer påvirker de estimerede årlige omkostninger, CO2e-forbrug og antal ikke-allokerede ture."
            />
            <FleetSimulationHandler />
        </>
    );
}
