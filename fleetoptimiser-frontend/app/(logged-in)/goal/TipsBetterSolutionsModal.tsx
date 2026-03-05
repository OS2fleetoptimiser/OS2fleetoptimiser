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

export default function TipsAutomatic() {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <div className="w-42">
      <p className="text-sm no-underline hover:underline mt-6 cursor-pointer font-bold" onClick={handleOpen}>Tips til bedre resultater i automatisk simulering</p>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography className="mb-4 text-black" id="modal-modal-title" variant="h6" component="h2">
            Tips til bedre løsninger
          </Typography>
            <List
             sx={{
                  listStyleType: 'disc',
                }}
              >
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Hvis du ikke ser store ændringer sammenlignet med din simuleringsflåde, skyldes det typisk,
                  at der ikke er ekstra kapacitet i simuleringsflåden.</span>
                <List sx={{ listStyleType: 'circle', pl: 2 }}>
                  <ListItem sx={{ display: 'list-item' }}>
                    Juster <span className="font-medium italic">Antal i beholdning</span> for at frigøre pladser i flåden til at udskifte med andre køretøjer.
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    Modellen vil kun foreslå nye køretøjer, hvis kørselsbehovet ikke kan tilfredsstilles med den nuværende simuleringsflåde.
                  </ListItem>
                </List>
              </ListItem>
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Hvis du ser løsninger der har mere udledning og/eller større omkostning end den nuværende.</span>
                <List sx={{ listStyleType: 'circle', pl: 2 }}>
                  <ListItem sx={{ display: 'list-item' }}>
                    Juster prioritering mellem omkostning og CO2e udledning. 50/50 anbefales, da der her vægtes lige mellem de to.
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    Vælg flere testkøretøjer i <span className="font-medium italic">Testkøretøjer</span> så modellen har flere valg.
                  </ListItem>
                </List>
              </ListItem>
              <ListItem className="mb-4" sx={{ display: 'list-item' }}>
                <span className="font-semibold">Hvis du ikke ser nogen cykler i løsningen.</span>
                <List sx={{ listStyleType: 'circle', pl: 2 }}>
                  <ListItem sx={{ display: 'list-item' }}>
                    Sikre at du har cykler blandt dine testkøretøjer.
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    Det bliver testet i modellen, om det er fordelagtigt at tilføje cykler til løsningerne for det valgte kørselsdata.
                    Hvis effekten ikke er stor nok, så biler kan fjernes i stedet for cykler, vil cykler ikke blive tilføjet.
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    Sørg for at cykelkonfigurationen og vagtlag muliggøre at rundture kan allokeres til cykler. Hvis der på lokationen primært køres
                    lange ture, vil det have begrænset effekt at tilføje cykler til løsningen.
                  </ListItem>
                </List>
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