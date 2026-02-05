import {useState} from "react";
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import {DialogActions, List, ListItem} from "@mui/material";

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '40rem',
  bgcolor: 'background.paper',
  boxShadow: 24,
  paddingRight: 8,
  paddingLeft: 8,
  paddingTop: 6,
  paddingBottom: 2,
  border: 0,
  outline: 'none'
};

export default function TipsModal() {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div className="w-42">
      <p className="text-sm no-underline hover:underline mt-2 cursor-pointer" onClick={handleOpen}>Tips til forbedring af rundturspræcision.</p>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography className="mb-4 text-black" id="modal-modal-title" variant="h6" component="h2">
            Tips til forbedring af rundturspræcision
          </Typography>
            <List
             sx={{
                  listStyleType: 'disc',
                }}
              >
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Hvis lokationen er blå, er lokationen ændret inden for den seneste måned, derfor kan præcisionen stadig ændres.</span>
              </ListItem>
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Hold køretøjerne opdateret på den korrekte lokation.</span>
                <ListItem>
                  Justér køretøjernes tilknyttet lokation enten i dit flådestyringssystem eller direkte i FleetOptimiser køretøjskonfiguration.
                </ListItem>
                <ListItem>
                  Det kan have indvirkning på rundturspræcisionen, hvis køretøjet kører fra andre lokationer.
                </ListItem>
              </ListItem>
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Tjek at parkeringspunkt(erne) er præcise og repræsentative for lokationen.</span>
                <ListItem>
                  Juster de enkelte parkingspunkter ved at klikke ind på en lokation.
                </ListItem>
                <ListItem>
                  Sørg for at køretøjerne typisk parkeres tæt på parkeringspunkterne.
                </ListItem>
                <ListItem>
                  Hav ikke for stor geografisk spredning på parkeringspunkterne (+300 meter).
                </ListItem>
              </ListItem>
              <ListItem className="" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Sikre spredning mellem lokationer der geografisk ligger tæt på hinanden.</span>
                <ListItem>
                  Parkeringspunkter mellem lokationer der ligger tæt på hinanden kan forstyrre aggregeringen.
                </ListItem>
                <ListItem>
                  Overvej om geografiske tætte lokationer kan sammenlægges og benyt afdeling og forvaltning til adskillelse af køretøjer.
                </ListItem>
              </ListItem>
          </List>
          <DialogActions>
            <Button variant="contained" color="secondary" onClick={() => setOpen(false)}>Luk</Button>
          </DialogActions>
        </Box>
      </Modal>
    </div>
  );
}