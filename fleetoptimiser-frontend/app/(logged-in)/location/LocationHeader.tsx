'use client';

import { ExtendedLocationInformation, ChangeLocationAddress } from "@/components/hooks/useGetLocationPrecision";
import EditIcon from '@mui/icons-material/Edit';
import {useState} from "react";
import {Alert, Card, CardContent, Snackbar, TextField, Typography} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
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
        setGivenTitle(title ?? '');
    }

    const handleSaveName = () => {
        setEditTitle(false);
        if (locationData.id) {
            ChangeLocationAddress(locationData.id, localTitle);
            setOpenSnackBar(true);
        }
    }
    // todo provide tips to improve precision
    const successThreshold = 80
    return (
        <>
            {
                locationData &&
                <div>
                    <div className="flex items-center mb-4 h-12 w-96">
                        {
                            !editTitle && <>
                                <div className={title == 'Indtast adresse' ? "text-red-500" : ""}>{localTitle}</div>
                                { hasWritePrivilege &&
                                    <EditIcon onClick={() => setEditTitle(true)} className="ml-4 text-gray-500 cursor-pointer" fontSize="small"/>
                                }
                            </>
                        }
                        {
                            editTitle && <>
                                <TextField defaultValue={title} variant="filled" size="small" label="Adresse"
                                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    setLocalTitle(event.target.value);
                                    setGivenTitle(event.target.value);
                                  }}
                                />

                                <SaveIcon onClick={() => handleSaveName()} className="ml-4 text-gray-500 cursor-pointer" fontSize="small"/>
                                <CloseIcon onClick={() => {
                                    setEditTitle(false)
                                }} className="ml-4 text-gray-500 cursor-pointer" fontSize="small"/>
                            </>
                        }

                    </div>
                    <div className="flex my-4 gap-2">
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Præcision</Typography>
                                <Typography variant="h4" component="p" sx={{ color: locationData.precision >= successThreshold ? 'success.main' : 'error.main' }}>
                                    {Math.round(locationData.precision)}%
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>Testpræcision</Typography>
                                <Typography variant="h4" component="p" sx={{ color: testPrecision ? (testPrecision * 100 >= successThreshold ? 'success.main' : 'error.main') : 'text.primary' }}>
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