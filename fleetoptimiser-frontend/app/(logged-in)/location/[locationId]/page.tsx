'use client';

import { useRouter } from 'next/navigation';
import dayjs from "dayjs";
import {
    useTestLocationPrecision,
    useGetSingleLocationPrecision,
    patchLocation, ExtendedLocationInformation, createLocation
} from "@/components/hooks/useGetLocationPrecision";
import { LocationHeader } from "@/app/(logged-in)/location/LocationHeader";
import {Alert, Button, CircularProgress, Snackbar} from "@mui/material";
import dynamic from "next/dynamic";
import { use, useState, useEffect } from "react";
import { ParkingSpotList } from "@/app/(logged-in)/location/ParkingSpotList";
import { AllowedStart } from "@/components/hooks/useGetLocationPrecision";
import LoadingOverlay from "@/components/LoadingOverlay";
import Tooltip from '@mui/material/Tooltip';
import {ConfirmSave} from "@/app/(logged-in)/location/ConfirmSave";
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";


const ParkingMap = dynamic(() => import('@/app/(logged-in)/location/ParkingMap'), {
  ssr: false,
});


const newLocationInformation: ExtendedLocationInformation = {
    id: null,
    address: '',
    latitude: null,
    longitude: null,
    additional_starts: null,
    car_count: 0,
    addition_date: null,
    precision: 0,
    roundtrip_km: 0,
    km: 0
}

export default function Page({ params }: { params: Promise<{ locationId?: string }> }){
    const { locationId } = use(params);
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const router = useRouter();
    const startDate = dayjs().subtract(1, 'month').toDate();

    const [parkingSpots, changeParkingSpots] = useState<AllowedStart>();
    const [clickEnabled, setClickEnabled] = useState<boolean>(false);
    const [noChanges, setNoChanges] = useState<boolean>(true);
    const [openSnackBar, setOpenSnackBar] = useState<boolean>(false);
    const [snackText, setSnackText] = useState<string>('');
    const isEditMode = !!locationId;
    const { data: fetchedData, isPending: isLoading, error } = useGetSingleLocationPrecision(startDate, parseInt(locationId ?? '0'));
    const data = isEditMode ? (fetchedData ?? newLocationInformation) : newLocationInformation;
    const testingEnabled = true; // todo make this an env

    const [givenTitle, setGivenTitle] = useState<string>(isEditMode ? '' : 'Indtast adresse');
    useEffect(() => {
      if (data) {
        changeParkingSpots(data);
      }
    }, [data]);
    const isTesting = (status: string | undefined) => {
        switch (status) {
            case 'PENDING':
            case 'STARTED':
            case 'PROGRESS':
                return true;
            default:
                return false;
        }
    };

    const handleSave = async () => {
        if (isEditMode) {
            setSnackText("Lokationen blev opdateret");
            await patchLocation(parkingSpots);
            setOpenSnackBar(true);
        } else {
            setSnackText("Lokationen blev oprettet");
            let copyPs = {
                ...parkingSpots,
                id: null,
                address: givenTitle || "",
                latitude: parkingSpots?.latitude ?? null,
                longitude: parkingSpots?.longitude ?? null,
                additional_starts: parkingSpots?.additional_starts ?? [],
                car_count: 0,
                addition_date: dayjs().toDate().toISOString()
            };
            const newLocation = await createLocation(copyPs);
            setOpenSnackBar(true);
            router.push(`/location/${newLocation.id}`)
        }
    };

    const testPrecision = useTestLocationPrecision(undefined, startDate, parseInt(locationId || '0'), parkingSpots);
    return (
        <>
            <div>
                {(!isLoading || !isEditMode) &&
                    <div className="flex flex-col overflow-hidden">
                        <LocationHeader
                            locationData={data}
                            testPrecision={testPrecision.query.data?.result?.precision}
                            title={isEditMode ? data?.address : givenTitle}
                            setGivenTitle={setGivenTitle}/>
                        <div className="flex flex-1 mt-16">
                            <div className="w-168 overflow-auto">
                                <h3>Parkeringspunkter på lokationen</h3>
                                <ParkingSpotList setNoChanges={setNoChanges} parkingSpots={parkingSpots} changeParkingSpots={changeParkingSpots} clickEnabled={clickEnabled} setClickEnabled={setClickEnabled}/>
                                <div className="my-20 flex space-x-10 justify-center">
                                    {
                                        !testingEnabled &&
                                        <Tooltip title="Præcisionstest er deaktiveret. Dit flådestyringssystem tillader ikke at hente kørselsdata flere gange.">
                                            <span>
                                                <Button variant="contained" color="success" disabled={true}>Test
                                                præcision</Button>
                                            </span>
                                        </Tooltip>
                                    }

                                    {
                                        testingEnabled &&
                                        <Button variant="contained" color="success"
                                             disabled={(!hasWritePrivilege) || (noChanges || parkingSpots?.latitude === null) || (data.car_count === null || data.car_count === 0)}
                                             onClick={() => testPrecision.startPrecisionTest()}>
                                            Test præcision
                                        </Button>
                                    }
                                    <ConfirmSave
                                        disabled={noChanges || parkingSpots?.latitude === null || !hasWritePrivilege}
                                        buttonText={isEditMode ? "Bekræft ændringer" : "Opret Lokation"}
                                        handleSave={handleSave}
                                    />
                                </div>
                            </div>
                            <div className="w-168 h-168 overflow-hidden">
                                <ParkingMap
                                    setNoChanges={setNoChanges}
                                    parkingSpots={parkingSpots}
                                    changeParkingSpots={changeParkingSpots}
                                    clickEnabled={clickEnabled}
                                    setClickEnabled={setClickEnabled}
                                />
                            </div>
                        </div>
                    </div>
                }
                {
                    isLoading && isEditMode && <CircularProgress/>
                }
                {
                    testPrecision.query.data && isTesting(testPrecision.query.data?.status) && testPrecision.running && (
                        <LoadingOverlay
                            status={testPrecision.query.data.status}
                            progress={testPrecision.query.data.progress ? testPrecision.query.data.progress.progress * 100 : 0}
                            setCancel={testPrecision.stopPrecisionTest}
                            buttonText={'Afbryd præcisionstest'}
                            pendingText={testPrecision.query.data.status === 'PENDING' ? 'Starter test' : 'Tester præcision'}
                        />
                    )
                }
                {
                    openSnackBar && (
                        <Snackbar open={openSnackBar} autoHideDuration={2000} onClose={() => setOpenSnackBar(false)}>
                            <Alert severity="success">{snackText}</Alert>
                        </Snackbar>
                    )
                }
            </div>
        </>
    )
}
