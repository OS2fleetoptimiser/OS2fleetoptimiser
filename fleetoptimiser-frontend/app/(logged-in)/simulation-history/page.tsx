'use client';

import { Fragment } from 'react';
import { useGetFleetSimulationHistory, useGetGoalSimulationHistory } from '@/components/hooks/useGetSimulationHistory';
import { Divider, Link, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import dayjs from 'dayjs';

export default function Page() {
    const fleetSimulationHistory = useGetFleetSimulationHistory();
    const goalSimulationHistory = useGetGoalSimulationHistory();

    return (
        <div>
            <div className="mb-8 mx-2">
                <h2 className="text-3xl mb-2">Manuel simulering historik</h2>
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
            <div className="mb-4 mx-2">
                <h2 className="text-3xl mb-2">Automatisk simulering historik</h2>
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
