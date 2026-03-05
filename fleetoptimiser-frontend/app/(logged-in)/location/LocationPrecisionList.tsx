'use client';

import UpdateIcon from '@mui/icons-material/Update';
import {AllowedStart, ExtendedLocationInformation} from "@/components/hooks/useGetLocationPrecision";
import Link from "next/link";
import dayjs from "dayjs";
import { Tooltip } from '@mui/material';

type Props = {
    data?: ExtendedLocationInformation[]
}

export const LocationPrecisionList = ({ data }: Props) => {
    const compareDate = dayjs().subtract(1, 'month').toDate();
    return (
        <>
            <div className="inline-flex flex-row items-center font-bold mt-12 mb-4 sticky top-0 bg-white z-10">
                <div className="w-68">Adresse</div>
                <div className="w-48 text-right">Antal køretøjer</div>
                <div className="w-48 text-right">Antal parkeringspunkter</div>
                <div className="w-48 text-right">Kilometer i rundtur</div>
                <div className="w-48 text-right">Kilometer total</div>
                <div className="w-48 text-right">Præcision</div>
            </div>
            {
                data &&
                data.sort((a, b) => a.address.localeCompare(b.address)).map(location =>
                    {
                        const recentlyUpdated = isLocationRecentlyUpdated(location, compareDate)
                return (
                    <Link key={'locationList' + location.id} className={recentlyUpdated ? "no-underline text-blue-500" : "no-underline text-black"}
                        href={`/location/${location.id}`}>
                    <div className="inline-flex flex-row items-center border-b h-14 hover:scale-101 duration-100 ease-in-out">
                        <div className="w-68">{location.address}</div>
                        <div className="w-48 text-right">{location.car_count}</div>
                        <div
                            className="w-48 flex items-center justify-end">
                            {recentlyUpdated && <Tooltip title="Lokationen er opdateret indenfor den sidste måned med parkeringspunkter. Præcisionen kan derfor stadig ændre sig."><UpdateIcon className="mr-2" fontSize="small"/></Tooltip>}
                            {1 + (location.additional_starts ? location.additional_starts?.length : 0)}</div>
                        <div className="w-48 text-right">{Math.round(location.roundtrip_km).toLocaleString()} km</div>
                        <div className="w-48 text-right">{Math.round(location.km).toLocaleString()} km</div>
                        <div
                            className={location.precision >= 80 ? "w-48 text-green-500 text-right font-bold" : location.precision === 0 ? "w-48 text-right font-bold" : "w-48 text-red-500 text-right font-bold"}>{Math.round(location.precision)}%
                        </div>
                    </div>
                    </Link>
                        )
                    }

                )
            }
        </>
    )
}

function isLocationRecentlyUpdated(location: AllowedStart, compareDate: Date) {
    if (location.addition_date && new Date(location.addition_date) > compareDate) {
        return true;
    }

    if (location.additional_starts && location.additional_starts.length > 0) {
        return location.additional_starts.some(addition => {
            return addition.addition_date && new Date(addition.addition_date) > compareDate;
        });
    }

    return false;
}
