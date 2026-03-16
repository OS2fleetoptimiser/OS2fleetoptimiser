'use client';
import dayjs from "dayjs";

import { KeyLocationFigures } from "@/app/(logged-in)/location/KeyLocationFigures";
import { LocationPrecisionList } from "@/app/(logged-in)/location/LocationPrecisionList";
import { useGetLocationPrecision } from "@/components/hooks/useGetLocationPrecision";
import { Button, CircularProgress } from '@mui/material';
import PageTitle from '@/components/PageTitle';
import TipsModal from "@/app/(logged-in)/location/TipsModal";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";

export default function Page() {
    const startDate = dayjs().subtract(1, 'month').toDate();
    const { data, isPending: isLoading } = useGetLocationPrecision(startDate);
    return (
        <>
            <PageTitle
                title="Lokationer"
                subtitle="Oversigt over præcisionen på rundturs-aggregering. Justér parkeringspunkter for at forbedre kvaliteten af data fra flådestyringssystemet. Præcisionen indikerer, hvor godt algoritmen sammensætter GPS-punkter til rundture, ikke antallet af gemte kilometer."
            />
            <TipsModal/>
            {!isLoading &&
                <div className="mb-20">
                    <KeyLocationFigures data={data}/>
                    <div className="flex justify-end mt-4 mb-2">
                        <Button
                            component={Link}
                            href="/location/new"
                            variant="contained"
                            startIcon={<AddIcon />}
                        >
                            Tilføj ny lokation
                        </Button>
                    </div>
                    <LocationPrecisionList data={data}/>

                </div>
            }
            {isLoading && <CircularProgress/>}
        </>
    )
}
