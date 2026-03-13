import {Accordion, AccordionDetails, AccordionSummary} from '@mui/material';
import { BiListUl, BiListPlus, BiListMinus } from 'react-icons/bi';
import { useAppSelector } from '@/components/redux/hooks';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { goalSolution } from '@/components/hooks/useSimulateGoal';
import PageTitle from '@/components/PageTitle';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import {settings} from "@/components/hooks/useGetSettings";
import Tooltip from "@mui/material/Tooltip";
import AxiosBase from "@/components/AxiosBase";
import Link from "next/link";

const ResultTable = ({ solutions, settings, goalSimulationId }: { solutions: goalSolution[], settings: settings, goalSimulationId?: string }) => {
    const currentFleet = useAppSelector((state) => state.simulation.selectedVehicles);

    const icon = (count: number) => {
        if (count < 0) {
            return <BiListMinus></BiListMinus>;
        } else if (count > 0) {
            return <BiListPlus></BiListPlus>;
        } else {
            return <BiListUl></BiListUl>;
        }
    };

    return (
        <div className="mb-2 mt-12">
            {solutions.map((solution, i) => (
                <Accordion key={i}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <div className="flex items-center">{icon(solution.vehicles.length - currentFleet.length)}</div>
                        <div>
                            <span className="w-1/4">{`Løsning ${i + 1}:`}</span>
                            <span className="w-1/4 mx-4">
                                Årlig besparelse:{' '}
                                <span className={solution.current_expense - solution.simulation_expense >= 0 ? 'text-green-500' : 'text-red-500'}>
                                    {(solution.current_expense - solution.simulation_expense).toLocaleString()} DKK
                                </span>
                            </span>
                            <span className="w-1/4">
                                Årlig CO2e reduktion:{' '}
                                <span className={solution.current_co2e - solution.simulation_co2e >= 0 ? 'text-green-500' : 'text-red-500'}>
                                    {(+(solution.current_co2e - solution.simulation_co2e).toFixed(3)).toLocaleString()} Ton Co2e
                                </span>
                            </span>
                            {solution.unallocated > 0 &&
                                <span className="ml-4 w-1/4">
                                    Ukørte ture:{' '}
                                    <span className={solution.unallocated <= settings.simulation_settings.slack ? 'text-green-500' : 'text-red-500'}>
                                        {solution.unallocated}
                                    </span>
                                </span>
                            }
                        </div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <div className="flex">
                            <div className="w-2/3">
                                <PageTitle level="section" title="Flådesammensætning" />
                            </div>
                            <div className="flex w-1/3 justify-end items-center">
                                {
                                    goalSimulationId &&
                                    <Tooltip title="Download resulater til Excel">
                                    <Link
                                        href={`${AxiosBase.getUri()}goal-simulation/simulation/${goalSimulationId}?download=true&solution_index=${i}`}
                                    >
                                        <DownloadIcon
                                            className="cursor-pointer mr-4 hover:scale-105"
                                        />
                                    </Link>
                                </Tooltip>
                                }
                            </div>
                        </div>
                        <table className="border-collapse mb-2 cartable w-full">
                            <thead className="border-b">
                                <tr>
                                    <th className="text-left p-2">Biltype</th>
                                    <th className="text-left p-2">Årlig omk. (DKK)</th>
                                    <th className="text-left p-2">Drivmiddel forbrug</th>
                                    <th className="text-left p-2">Forskel</th>
                                    <th className="text-left p-2">Antal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {solution.vehicles.map((vehicle, i) =>
                                    {
                                        let countString: string | number = vehicle.count_difference ?? vehicle.count
                                        countString = (vehicle.count_difference && countString > 0) ? '+ ' + countString : countString
                                        return (<tr key={i}>
                                                <td className="p-2 border-b">{vehicle.name}</td>
                                                <td className="p-2 border-b">{vehicle.omkostning_aar.toLocaleString()}</td>
                                                <td className="p-2 border-b">{vehicle.emission}</td>
                                                <td className="p-2 border-b">{countString}</td>
                                                <td className="p-2 border-b">{vehicle.count}</td>
                                            </tr>)
                            }
                                )}
                            <tr>
                                <td className="p-2">Total</td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td className="p-2">{solution.vehicles.reduce((summed: number, vehicle) => {
                                    summed += vehicle.count
                                    return summed
                                }, 0)}</td>
                            </tr>
                            </tbody>
                        </table>
                        <PageTitle level="section" title="Simuleringsdetaljer" />
                        <table className="w-full border-collapse">
                            <thead className="border-b">
                                <tr>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-left p-2">Enhed</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="text-left p-2">Nuværende total omkostning</td>
                                    <td>{solution.current_expense.toLocaleString()} DKK/år</td>
                                </tr>
                                <tr>
                                    <td className="text-left p-2">Simuleret total omkostning</td>
                                    <td>{solution.simulation_expense.toLocaleString()} DKK/år</td>
                                </tr>
                                <tr className="font-bold">
                                    <td className="text-left p-2">Besparelse i omkostning</td>
                                    <td>{(solution.current_expense - solution.simulation_expense).toLocaleString()} DKK/år</td>
                                </tr>
                                <tr>
                                    <td className="text-left p-2">Nuværende udledning</td>
                                    <td>{(+solution.current_co2e.toFixed(3)).toLocaleString()} Ton CO2e/år</td>
                                </tr>
                                <tr>
                                    <td className="text-left p-2">Simuleret udledning</td>
                                    <td>{(+solution.simulation_co2e.toFixed(3)).toLocaleString()} Ton CO2e/år</td>
                                </tr>
                                <tr className="font-bold">
                                    <td className="text-left p-2">Reduktion i udledning</td>
                                    <td>{(+(solution.current_co2e - solution.simulation_co2e).toFixed(3)).toLocaleString()} Ton CO2e/år</td>
                                </tr>
                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
            ))}
        </div>
    );
};

export default ResultTable;
