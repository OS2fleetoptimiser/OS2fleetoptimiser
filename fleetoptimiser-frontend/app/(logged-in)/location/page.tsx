'use client';
import dayjs from "dayjs";

import { KeyLocationFigures } from "@/app/(logged-in)/location/KeyLocationFigures";
import { LocationPrecisionList } from "@/app/(logged-in)/location/LocationPrecisionList";
import { useGetLocationPrecision } from "@/components/hooks/useGetLocationPrecision";
import { CircularProgress } from '@mui/material';
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
                    <LocationPrecisionList data={data}/>
                    <Link href={'/location/new'} className="no-underline text-black">
                        <div className="flex flex-row items-center mt-12 mt-4 h-14 hover:scale-101 duration-100 ease-in-out">
                            <div className="w-68 flex items-center">
                                Tilføj ny lokation <AddIcon className="ml-4"/>
                            </div>
                        </div>
                    </Link>

                </div>
            }
            {isLoading && <CircularProgress/>}
        </>
    )
}
