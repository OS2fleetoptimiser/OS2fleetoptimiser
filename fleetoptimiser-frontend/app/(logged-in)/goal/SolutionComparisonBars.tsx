import { SimulationResults } from '@/app/(logged-in)/fleet/ConvertData';
import { CostComparisonBar } from '@/app/(logged-in)/goal/ComparisonBar';
import { Card, CardContent, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export const SolutionComparisonBars = ({ solutions }: { solutions: SimulationResults[] }) => {
    const cost = solutions.map((sol, i) => ({ value: sol.simulationExpense, label: `Løsning ${i + 1}` }));
    const currentCost = solutions[0].currentExpense;

    const emission = solutions.map((sol, i) => ({ value: sol.simulationEmission, label: `Løsning ${i + 1}` }));
    const currentEmission = solutions[0].currentEmission;
    return (
        <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="w-full h-96">
                <CardContent className="h-full flex flex-col">
                    <Typography variant="subtitle2" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Omkostningssammenligning (DKK/år)
                        <Tooltip title="Den samlede årlige besparelse for den højeste rangerede løsning sammenlignet med den nuværende flåde. Beløbet er summeret fra de udvalgte køretøjers årlige omkostninger og de beregnede simulerede omkostninger forbundet med driften. Drivmiddelforbrug er baseret på POGI miljøværktøj." placement="right">
                            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Typography>
                    <div className="flex-1 min-h-0">
                        <CostComparisonBar currentValue={currentCost} solutions={cost} yAxis="DKK/år" />
                    </div>
                </CardContent>
            </Card>
            <Card className="w-full h-96">
                <CardContent className="h-full flex flex-col">
                    <Typography variant="subtitle2" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Udledningssammenligning (Ton CO2e/år)
                        <Tooltip title="Den samlede årlige reduktion i CO2e-udledning for den højeste rangerede løsning. Tallet er beregnet vha. POGI miljøværktøj, hvorfra det udvalgte køretøjs allokerede ture, er udgangspunkt for det enkelte køretøjs årlige CO2e. Tallet er summeret fra den valgte dataperiode til årsværk." placement="right">
                            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
                        </Tooltip>
                    </Typography>
                    <div className="flex-1 min-h-0">
                        <CostComparisonBar currentValue={currentEmission} solutions={emission} yAxis="Tons CO2e/år" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
