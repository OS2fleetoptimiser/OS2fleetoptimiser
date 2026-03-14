import { goalSolution } from '@/components/hooks/useSimulateGoal';
import ToolTip from '@/components/ToolTip';
import Typography from '@mui/material/Typography';
import { Card, CardContent } from '@mui/material';

const GoalSimulationResultStats = ({ solution }: { solution: goalSolution }) => {
    return (
        <div className="flex justify-between mb-2">
            <Card className="flex-1 mr-10" sx={{ textAlign: 'center' }}>
                <CardContent>
                    <Typography variant="h5">Besparelse (DKK/år)</Typography>
                    <ToolTip>
                        Den samlede årlige besparelse for den højeste rangerede løsning sammenlignet med den nuværende flåde. Beløbet er summeret fra de udvalgte køretøjers årlige omkostninger og de
                        beregnede simulerede omkostninger forbundet med driften. Drivmiddelforbrug er baseret på POGI miljøværktøj.
                    </ToolTip>
                    <p className={'text-3xl font-bold ' + (solution.simulation_expense <= solution.current_expense ? 'text-green-500' : 'text-red-500')}>
                        {(solution.current_expense - solution.simulation_expense).toFixed(0).toLocaleString()} DKK
                    </p>
                </CardContent>
            </Card>
            <Card className="flex-1 ml-10" sx={{ textAlign: 'center' }}>
                <CardContent>
                    <Typography variant="h5">Reduktion udledning (Ton CO2e/år)</Typography>
                    <ToolTip>
                        Den samlede årlige reduktion i CO2e-udledning for den højeste rangerede løsning. Tallet er beregnet vha. POGI miljøværktøj, hvorfra det udvalgte
                        køretøjs allokerede ture, er udgangspunkt for det enkelte køretøjs årlige CO2e. Tallet er summeret fra den valgte dataperiode til årsværk.
                    </ToolTip>
                    <p className={'text-3xl font-bold ' + (solution.simulation_co2e <= solution.current_co2e ? 'text-green-500' : 'text-red-500')}>
                        {((solution.current_co2e - solution.simulation_co2e).toFixed(4)).toLocaleString()} Ton CO2e
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default GoalSimulationResultStats;
