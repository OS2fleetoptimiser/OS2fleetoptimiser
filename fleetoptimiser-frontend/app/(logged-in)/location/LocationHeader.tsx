'use client';

import { ExtendedLocationInformation, ChangeLocationAddress } from "@/components/hooks/useGetLocationPrecision";
import EditIcon from '@mui/icons-material/Edit';
import {useEffect, useState} from "react";
import {Alert, Button, Card, CardContent, IconButton, Snackbar, TextField, Typography} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";

type LocationHeaderProps = {
    locationData: ExtendedLocationInformation;
    testPrecision?: number;
    title?: string;
    setGivenTitle: (s: string) => void;
}

export const LocationHeader = ({locationData, testPrecision, title, setGivenTitle} : LocationHeaderProps) => {
    const {hasWritePrivilege} = useWritePrivilegeContext();
    const [openSnackBar, setOpenSnackBar] = useState<boolean>(false);
    const [editTitle, setEditTitle] = useState<boolean>(false);
    const [localTitle, setLocalTitle] = useState(title ?? '');
    const [prevTitle, setPrevTitle] = useState(title);
    if (title !== prevTitle) {
        setPrevTitle(title);
        setLocalTitle(title ?? '');
    }

    useEffect(() => {
        if (title !== undefined) {
            setGivenTitle(title);
        }
    }, [title, setGivenTitle]);

    const handleSaveName = () => {
        setEditTitle(false);
        if (locationData.id) {
            ChangeLocationAddress(locationData.id, localTitle);
            setOpenSnackBar(true);
        }
    }
    return (
        <>
            {
                locationData &&
                <div>
                    <div className="flex items-center mb-4 gap-2 p-1">
                        {!editTitle ? (
                            <>
                                <Typography
                                    variant="body1"
                                    sx={{ color: title === 'Indtast adresse' ? 'error.main' : 'text.primary', fontWeight: 500 }}
                                >
                                    {localTitle}
                                </Typography>
                                {hasWritePrivilege && (
                                    <IconButton size="small" onClick={() => setEditTitle(true)}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </>
                        ) : (
                            <>
                                <TextField
                                    defaultValue={title}
                                    size="small"
                                    placeholder="Indtast adresse"
                                    sx={{ minWidth: 350 }}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setLocalTitle(event.target.value);
                                        setGivenTitle(event.target.value);
                                    }}
                                    autoFocus
                                />
                                <Button variant="contained" size="small" onClick={handleSaveName}>
                                    Gem
                                </Button>
                                <IconButton size="small" onClick={() => setEditTitle(false)}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </>
                        )}
                    </div>
                    <div className="flex my-4 gap-2">
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Præcision</Typography>
                                <Typography variant="h4" component="p">
                                    {Math.round(locationData.precision)}%
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Testpræcision</Typography>
                                <Typography variant="h4" component="p">
                                    {testPrecision ? Math.round(testPrecision * 100) + '%' : 'Ingen data'}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Total kilometer</Typography>
                                <Typography variant="h4" component="p">
                                    {Math.round(locationData.km).toLocaleString()}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Antal køretøjer</Typography>
                                <Typography variant="h4" component="p">
                                    {locationData.car_count}
                                </Typography>
                            </CardContent>
                        </Card>
                    </div>
                {
                    openSnackBar && (
                        <Snackbar open={openSnackBar} autoHideDuration={2000} onClose={() => setOpenSnackBar(false)}>
                            <Alert severity="success">Lokation titel opdateret</Alert>
                        </Snackbar>
                    )
                }
                </div>
            }
        </>
    )
}