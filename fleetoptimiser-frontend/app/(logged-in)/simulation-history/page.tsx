'use client';

import { Fragment } from 'react';
import { useGetFleetSimulationHistory, useGetGoalSimulationHistory } from '@/components/hooks/useGetSimulationHistory';
import { Divider, Link, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import PageTitle from '@/components/PageTitle';
import dayjs from 'dayjs';

export default function Page() {
    const fleetSimulationHistory = useGetFleetSimulationHistory();
    const goalSimulationHistory = useGetGoalSimulationHistory();

    return (
        <div>
            <PageTitle
                title="Simuleringshistorik"
                subtitle="Oversigt over tidligere simuleringer kørt på systemet."
            />
            <div className="mb-8">
                <Typography variant="h6" sx={{ mb: 1 }}>Manuel simulering</Typography>
                <List className="bg-white drop-shadow-md">
                    {fleetSimulationHistory.data &&
                        fleetSimulationHistory.data.map((history, index) => (
                            <Fragment key={history.id}>
                                {!!index && <Divider></Divider>}
                                <Link className="no-underline" href={'/fleet/' + history.id}>
                                    <ListItem disablePadding>
                                        <ListItemButton>
                                            <ListItemText
                                                primary={`Simuleringsdato: ${dayjs(history.simulation_date).format('DD-MM-YYYY')} | ${
                                                    history.locations ? history.locations : history.location
                                                } fra ${history.start_date} til ${history.end_date}`}
                                            ></ListItemText>
                                        </ListItemButton>
                                    </ListItem>
                                </Link>
                            </Fragment>
                        ))}
                </List>
            </div>
            <div className="mb-4">
                <Typography variant="h6" sx={{ mb: 1 }}>Automatisk simulering</Typography>
                <List className="bg-white drop-shadow-md">
                    {goalSimulationHistory.data &&
                        goalSimulationHistory.data.map((history, index) => (
                            <Fragment key={history.id}>
                                {!!index && <Divider></Divider>}
                                <Link className="no-underline" href={'/goal/' + history.id}>
                                    <ListItem disablePadding>
                                        <ListItemButton>
                                            <ListItemText
                                                primary={`Simuleringsdato: ${dayjs(history.simulation_date).format('DD-MM-YYYY')} | ${
                                                    history.locations ? history.locations : history.location
                                                } fra ${history.start_date} til ${history.end_date}`}
                                            ></ListItemText>
                                        </ListItemButton>
                                    </ListItem>
                                </Link>
                            </Fragment>
                        ))}
                </List>
            </div>
        </div>
    );
}
