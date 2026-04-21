import { SimulationHighlight } from '@/components/hooks/useGetLandingPage';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { FleetChangeChip, PlusMinusChip, UnallocatedChip, SimTypeChip } from './ChipFormatting';
import PageTitle from '@/components/PageTitle';

function cutCharacters(str: string, cutAbove: number = 20) {
  return str.length > cutAbove ? str.slice(0, cutAbove) + '...' : str;
}

export default function SimulationHighlights({ simulations }: { simulations: SimulationHighlight[] }) {
  const router = useRouter();
  const handleClick = (iD: string, simType: string) => {
    router.push(`/${simType}/${iD.replace('celery-task-meta-', '')}`);
  };
  return (
    <div className="w-full">
      <PageTitle level="section" title="Seneste simuleringer" />
      <TableContainer sx={{ my: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dato</TableCell>
              <TableCell>Flådeændring</TableCell>
              <TableCell>Besparelse (kr)</TableCell>
              <TableCell>Reduktion (CO2e)</TableCell>
              <TableCell>Uallokerede rundture</TableCell>
              <TableCell>Lokation</TableCell>
              <TableCell>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {simulations &&
              simulations.map((sim, index) => (
                <TableRow
                  key={`${index}simHighlight`}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleClick(sim.id, sim.simulation_type)}
                >
                  <TableCell>{new Date(sim.simulation_date).toLocaleString()}</TableCell>
                  <TableCell>{FleetChangeChip(sim.fleet_change)}</TableCell>
                  <TableCell>{PlusMinusChip(sim.financial_savings)}</TableCell>
                  <TableCell>{PlusMinusChip(sim.co2e_savings, 'Ton')}</TableCell>
                  <TableCell>{UnallocatedChip(sim.unallocated)}</TableCell>
                  <TableCell>
                    <Tooltip placement="top" title={sim.addresses.join(', ')}>
                      <span>{cutCharacters(sim.addresses.join(', '))}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{SimTypeChip(sim.simulation_type)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
