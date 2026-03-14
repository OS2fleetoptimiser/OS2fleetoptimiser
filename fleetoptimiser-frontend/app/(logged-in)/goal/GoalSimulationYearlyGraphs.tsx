import { goalSolution } from '@/components/hooks/useSimulateGoal';
import ToolTip from '@/components/ToolTip';
import CostChart from './CostChart';
import EmissionChart from './EmissionChart';
import PageTitle from '@/components/PageTitle';
import { Card, CardContent } from '@mui/material';

const GoalSimulationYearlyGraphs = ({ solutions }: { solutions: goalSolution[] }) => {
    return (
        <>
            <Card>
                <CardContent>
                    <PageTitle level="section" title="Årlig omkostning i kr." />
                    <ToolTip>
                        Oversigt over total omkostninger for de forslået løsninger. Der vises de samlede omkostning inkl. drivmiddelforbrug beregnet ud fra de
                        allokerede ture og køretøjets forbrug. Det er beregnet vha. POGI miljøværktøj beregningsmetode.
                    </ToolTip>
                    <div className="h-80">
                        <CostChart
                            data={[
                                {
                                    solution: 'Mål',
                                    cost: solutions[0].current_expense,
                                },
                            ].concat(
                                solutions.map((s, i) => {
                                    return {
                                        solution: 'Løsning ' + ++i,
                                        cost: s.simulation_expense,
                                    };
                                })
                            )}
                        ></CostChart>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    <PageTitle level="section" title="Årlig udledning ton CO2e" />
                    <ToolTip>
                        Oversigt over CO2e-udledningen for de forslået løsninger. Udledningen er summeret fra den valgte datoperiode til årsværk. De allokerede
                        ture til de forskellige køretøjer, ligger til grund for udregningen, der bruger metoden fra POGIs miljøværktøj.
                    </ToolTip>
                    <div className="h-80">
                        <EmissionChart
                            data={[
                                {
                                    solution: 'Mål',
                                    emission: +solutions[0].current_co2e.toPrecision(4),
                                },
                            ].concat(
                                solutions.map((s, i) => {
                                    return {
                                        solution: 'Løsning ' + ++i,
                                        emission: +s.simulation_co2e.toPrecision(4),
                                    };
                                })
                            )}
                        ></EmissionChart>
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default GoalSimulationYearlyGraphs;
