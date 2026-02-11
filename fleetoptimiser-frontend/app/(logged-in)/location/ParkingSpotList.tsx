import {AllowedStart, ExtendedLocationInformation} from "@/components/hooks/useGetLocationPrecision";
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {useState} from "react";
import {ConfirmDeletion} from "@/app/(logged-in)/location/ConfirmDeletion";
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";

type ParkingListProps = {
    setNoChanges: (unchanged: boolean) => void;
    parkingSpots?: AllowedStart;
    changeParkingSpots: (e: any) => void;
    clickEnabled: boolean;
    setClickEnabled: (e: any) => void;
};

export const ParkingSpotList = ({ setNoChanges, parkingSpots, changeParkingSpots, setClickEnabled }: ParkingListProps) => {
    const {hasWritePrivilege} = useWritePrivilegeContext();
    const [confirmDeletionInfo, setConfirmDeletionInfo] = useState<{open: boolean, parkingType: string, parkingId?: number}>({open: false, parkingType: '', parkingId: undefined});

    const handleDelete = (parkingType: string, id?: number) => {
        const copyPs = {...parkingSpots}
        if (id && parkingType === 'addition' && parkingSpots?.additional_starts) {
            copyPs.additional_starts = parkingSpots?.additional_starts.filter(start => start.id != id)
        } else if (parkingType === 'parent'){
            copyPs.latitude = null
            copyPs.longitude = null
        }
        // if additional exists move the first up as parent
        if (copyPs.latitude === null && parkingSpots?.additional_starts && parkingSpots.additional_starts.length >= 1) {
            const newParent = parkingSpots.additional_starts.shift();
            copyPs.latitude = newParent?.latitude
            copyPs.longitude = newParent?.longitude
            copyPs.addition_date = newParent?.addition_date
        }
        setNoChanges(false);
        changeParkingSpots(copyPs);
    }

    const handleAdd = () => {
        setClickEnabled(true);
    }

    return (
        <>
            <div className="inline-flex flex-row items-center font-bold mt-10">
                <div className="w-32">Parkeringspunkt</div>
                <div className="w-40 text-right">Koordinator</div>
                <div className="w-40 text-right">Tilføjet</div>
                <div className="w-32 text-right"></div>
            </div>
            {
                parkingSpots &&
                parkingSpots.latitude &&
                parkingSpots.longitude &&
                <div className="inline-flex flex-row items-center h-14">
                    <div className="w-32">#1</div>
                    <div className="w-40 text-right">({parkingSpots.latitude.toFixed(4)}, {parkingSpots.longitude.toFixed(4)})</div>
                    <div className="w-40 text-right">{parkingSpots.addition_date?.split('T')[0]}</div>
                    <div className="w-32 text-right">
                        {hasWritePrivilege && <DeleteIcon onClick={() => setConfirmDeletionInfo({open: true, parkingType: 'parent'})} className="text-red-500 cursor-pointer hover:scale-105 ease-in-out duration-100"/>}
                    </div>
                </div>
            }
            {
                parkingSpots &&
                parkingSpots.additional_starts &&
                parkingSpots.additional_starts.map((spot, index) => (
                <div key={'parkingspot' + index} className="inline-flex flex-row items-center h-14">
                    <div className="w-32">#{parkingSpots.latitude ? 2+index : 1+index}</div>
                    <div className="w-40 text-right">({spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)})</div>
                    <div className="w-40 text-right">{spot.addition_date?.split('T')[0]}</div>
                    {/*// todo add check on the date */}
                    <div className="w-32 text-right">
                        {hasWritePrivilege && <DeleteIcon onClick={() => setConfirmDeletionInfo({open: true, parkingType: 'addition', parkingId: spot.id ?? undefined})} className="text-red-500 cursor-pointer  hover:scale-105 ease-in-out duration-100"/>}
                    </div>
                </div>
                ))
            }
            {hasWritePrivilege &&
                <div className="inline-flex flex-row items-center mt-10 cursor-pointer hover:scale-101 ease-in-out duration-100" onClick={() => handleAdd()}>
                    <div className="w-32">Tilføj ekstra punkt</div>
                    <div className="w-40 text-right"></div>
                    <div className="w-40 text-right"></div>
                    <div className="w-32 text-right">
                        <AddIcon/>
                    </div>
                </div>
            }
            {confirmDeletionInfo.open &&
                <ConfirmDeletion
                    open={confirmDeletionInfo.open}
                    parkingType={confirmDeletionInfo.parkingType}
                    parkingId={confirmDeletionInfo.parkingId}
                    setOpen={(open) => setConfirmDeletionInfo({...confirmDeletionInfo, open})}
                    handleDelete={handleDelete}
                />
            }
        </>
    )

}