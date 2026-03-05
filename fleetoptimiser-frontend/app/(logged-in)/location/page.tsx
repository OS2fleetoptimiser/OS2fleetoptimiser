'use client';
import dayjs from "dayjs";

import { KeyLocationFigures } from "@/app/(logged-in)/location/KeyLocationFigures";
import { LocationPrecisionList } from "@/app/(logged-in)/location/LocationPrecisionList";
import { useGetLocationPrecision } from "@/components/hooks/useGetLocationPrecision";
import { CircularProgress } from '@mui/material';
import TipsModal from "@/app/(logged-in)/location/TipsModal";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";

export default function Page() {
    const startDate = dayjs().subtract(1, 'month').toDate();
    const { data, isPending: isLoading } = useGetLocationPrecision(startDate);
    return (
        <>
            <h2>Lokationer</h2>
            <p className="text-explanation w-256 text-sm">Oversigt over hvor præcis aggregering af rundture er på dine lokationer. Præcisionen viser procentdelen af færdiggjorte rundture.
                Præcision er en indikation på hvor god aggregeringen er til at sammensætte komplette rundture, ikke hvor meget der bliver gemt fra flådestyringssystemet.
                Klik ind på en lokation, for at se tilknyttede parkeringspunkter og for at forøge præcision og kvaliteten med nye parkeringspunkter. GPS fejl og andre logging problemer gør
                det svært at nå 100% rundturspræcision, der sigtes efter en rundturspræcision på over 80%.
            </p>
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
