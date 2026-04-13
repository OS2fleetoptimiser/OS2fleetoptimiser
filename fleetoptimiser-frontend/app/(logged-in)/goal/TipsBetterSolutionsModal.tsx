'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

export default function TipsAutomatic() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="text"
        size="small"
        startIcon={<LightbulbOutlinedIcon />}
        onClick={() => setOpen(true)}
        sx={{ textTransform: 'none' }}
      >
        Tips til bedre resultater i automatisk simulering
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tips til bedre løsninger</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" fontWeight={600}>
            Hvis du ikke ser store ændringer sammenlignet med din simuleringsflåde, skyldes det typisk,
            at der ikke er ekstra kapacitet i simuleringsflåden.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5 }}>
            <li>
              Juster <em>Antal i beholdning</em> for at frigøre pladser i flåden til at udskifte med andre køretøjer.
            </li>
            <li>
              Modellen vil kun foreslå nye køretøjer, hvis kørselsbehovet ikke kan tilfredsstilles med den nuværende simuleringsflåde.
            </li>
          </Typography>

          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>
            Hvis du ser løsninger der har mere udledning og/eller større omkostning end den nuværende.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5 }}>
            <li>
              Juster prioritering mellem omkostning og CO2e udledning. 50/50 anbefales, da der her vægtes lige mellem de to.
            </li>
            <li>
              Vælg flere testkøretøjer i <em>Testkøretøjer</em> så modellen har flere valg.
            </li>
          </Typography>

          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>
            Hvis du ikke ser nogen cykler i løsningen.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
            <li>
              Sikre at du har cykler blandt dine testkøretøjer.
            </li>
            <li>
              Det bliver testet i modellen, om det er fordelagtigt at tilføje cykler til løsningerne for det valgte kørselsdata.
              Hvis effekten ikke er stor nok, så biler kan fjernes i stedet for cykler, vil cykler ikke blive tilføjet.
            </li>
            <li>
              Sørg for at cykelkonfigurationen og vagtlag muliggøre at rundture kan allokeres til cykler. Hvis der på lokationen primært køres
              lange ture, vil det have begrænset effekt at tilføje cykler til løsningen.
            </li>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Luk
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
