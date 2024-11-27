import { goalSolution } from '@/components/hooks/useSimulateGoal';
import ToolTip from '@/components/ToolTip';
import CostChart from './CostChart';
import EmissionChart from './EmissionChart';
import Typography from '@mui/material/Typography';

const GoalSimulationYearlyGraphs = ({ solutions }: { solutions: goalSolution[] }) => {
    return (
        <>
            <div className="bg-white drop-shadow-md mt-12 mb-2 p-2 custom-nav">
                <Typography variant="h3" className="text-center">
                    Årlig omkostning i kr.
                    <ToolTip>
                        Oversigt over total omkostninger for de forslået løsninger. Der vises de samlede omkostning inkl. drivmiddelforbrug beregnet ud fra de
                        allokerede ture og køretøjets forbrug. Det er beregnet vha. POGI miljøværktøj beregningsmetode.
                    </ToolTip>
                </Typography>
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
            </div>
            <div className="bg-white drop-shadow-md mt-12 mb-2 p-2 custom-nav">
                <Typography variant="h3" className="text-center">
                    Årlig udledning ton CO2e
                    <ToolTip>
                        Oversigt over CO2e-udledningen for de forslået løsninger. Udledningen er summeret fra den valgte datoperiode til årsværk. De allokerede
                        ture til de forskellige køretøjer, ligger til grund for udregningen, der bruger metoden fra POGIs miljøværktøj.
                    </ToolTip>
                </Typography>
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
            </div>
        </>
    );
};

export default GoalSimulationYearlyGraphs;
