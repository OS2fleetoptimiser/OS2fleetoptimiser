'use client';

import { ExtendedLocationInformation, ChangeLocationAddress } from "@/components/hooks/useGetLocationPrecision";
import Typography from "@mui/material/Typography";
import EditIcon from '@mui/icons-material/Edit';
import {useState} from "react";
import {Alert, Snackbar, TextField} from "@mui/material";
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
                    <h3>Lokation</h3>
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
                    <p className="text-explanation w-256 text-sm">Tilføj eller fjern eksisterende parkeringspunkter på lokationen. Test præcisionen med de ændrede parkeringspunkter på den seneste måneds data.
                    Gem ændringerne hvis du ser forbedringer i præcisionen. Herefter burde du se rundturspræcisionen stige for lokationen over den næste måned.
                    </p>
                    <div className="flex my-8 items-center">
                        <div className="bg-white custom-nav p-4 w-68">
                            <Typography variant="h4" className="mb-4">Præcision</Typography>
                            <Typography variant="h2" className={locationData.precision >= successThreshold ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{Math.round(locationData.precision)}%</Typography>
                        </div>
                        <div className="bg-white custom-nav mx-12 p-4 w-68">
                            <Typography variant="h4" className="mb-4">Testpræcision</Typography>
                            <Typography variant="h2" className={testPrecision ? testPrecision * 100 >= successThreshold ? "text-green-500 font-bold" : "text-red-500 font-bold" : "font-bold" }>{testPrecision ? (Math.round(testPrecision * 100)) + '%' : 'Ingen data'}</Typography>
                        </div>
                        <div className="bg-white custom-nav p-4 w-68">
                            <Typography variant="h4" className="mb-4">Total kilometer</Typography>
                            <Typography variant="h2" className="font-bold">{Math.round(locationData.km).toLocaleString()}</Typography>
                        </div>
                        <div className="bg-white custom-nav p-4 ml-12 w-68">
                            <Typography variant="h4" className="mb-4">Antal køretøjer</Typography>
                            <Typography variant="h2" className="font-bold">{locationData.car_count}</Typography>
                        </div>
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