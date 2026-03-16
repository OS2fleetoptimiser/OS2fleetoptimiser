'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

export default function TipsModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="text"
        size="small"
        startIcon={<LightbulbOutlinedIcon />}
        onClick={() => setOpen(true)}
        sx={{ mt: 1, textTransform: 'none' }}
      >
        Tips til forbedring af rundturspræcision
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tips til forbedring af rundturspræcision</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" fontWeight={600}>
            Hvis lokationen er blå, er lokationen ændret inden for den seneste
            måned, derfor kan præcisionen stadig ændres.
          </Typography>

          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>
            Hold køretøjerne opdateret på den korrekte lokation.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5 }}>
            <li>
              Justér køretøjernes tilknyttede lokation enten i dit
              flådestyringssystem eller direkte i FleetOptimiser
              køretøjskonfiguration.
            </li>
            <li>
              Det kan have indvirkning på rundturspræcisionen, hvis køretøjet
              kører fra andre lokationer.
            </li>
          </Typography>

          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>
            Tjek at parkeringspunkt(erne) er præcise og repræsentative for
            lokationen.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5 }}>
            <li>
              Justér de enkelte parkeringspunkter ved at klikke ind på en
              lokation.
            </li>
            <li>
              Sørg for at køretøjerne typisk parkeres tæt på
              parkeringspunkterne.
            </li>
            <li>
              Hav ikke for stor geografisk spredning på parkeringspunkterne
              (+300 meter).
            </li>
          </Typography>

          <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>
            Sikr spredning mellem lokationer, der geografisk ligger tæt på
            hinanden.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
            <li>
              Parkeringspunkter mellem lokationer der ligger tæt på hinanden kan
              forstyrre aggregeringen.
            </li>
            <li>
              Overvej om geografisk tætte lokationer kan sammenlægges, og benyt
              afdeling og forvaltning til adskillelse af køretøjer.
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
