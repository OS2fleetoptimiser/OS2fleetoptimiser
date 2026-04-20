import { useState } from 'react'
import { Divider, Tab, Tabs } from '@mui/material'
import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData'
import { SimulationResultsPage } from '@/app/(logged-in)/fleet/SimulationResults'
import PageTitle from '@/components/PageTitle'

export function SolutionPicker({ solutions, simulationId }: { solutions: SimulationResults[]; simulationId?: string }) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    return (
        <div>
            <PageTitle level="section" title="Løsningsdetaljer" />
            <Tabs
                value={selectedIndex}
                onChange={(_, v) => setSelectedIndex(v)}
                variant="scrollable"
                scrollButtons="auto"
            >
                {solutions.map((_, i) => (
                    <Tab key={i} label={`Løsning ${i + 1}`} value={i} />
                ))}
            </Tabs>
            <Divider sx={{ mb: 2 }} />
            <SimulationResultsPage
                key={selectedIndex}
                isLoading={false}
                simulationResults={solutions[selectedIndex]}
                simulationId={simulationId}
            />
        </div>
    )
}
