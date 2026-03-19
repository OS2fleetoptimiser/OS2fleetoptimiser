import { AllowedStart } from "@/components/hooks/useGetLocationPrecision";
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useState } from "react";
import { ConfirmDeletion } from "@/app/(logged-in)/location/ConfirmDeletion";
import { useWritePrivilegeContext } from "@/app/providers/WritePrivilegeProvider";
import {
    Button,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Card,
} from "@mui/material";

type ParkingListProps = {
    setNoChanges: (unchanged: boolean) => void;
    parkingSpots?: AllowedStart;
    changeParkingSpots: (e: any) => void;
    clickEnabled: boolean;
    setClickEnabled: (e: any) => void;
};

export const ParkingSpotList = ({ setNoChanges, parkingSpots, changeParkingSpots, setClickEnabled }: ParkingListProps) => {
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const [confirmDeletionInfo, setConfirmDeletionInfo] = useState<{ open: boolean; parkingType: string; parkingId?: number }>({ open: false, parkingType: '', parkingId: undefined });

    const handleDelete = (parkingType: string, id?: number) => {
        const copyPs = { ...parkingSpots }
        if (id && parkingType === 'addition' && parkingSpots?.additional_starts) {
            copyPs.additional_starts = parkingSpots?.additional_starts.filter(start => start.id != id)
        } else if (parkingType === 'parent') {
            copyPs.latitude = null
            copyPs.longitude = null
        }
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

    const rows: { id: string; label: string; coords: string; date: string; parkingType: string; parkingId?: number }[] = [];

    if (parkingSpots?.latitude && parkingSpots?.longitude) {
        rows.push({
            id: 'parent',
            label: '#1',
            coords: `(${parkingSpots.latitude.toFixed(4)}, ${parkingSpots.longitude.toFixed(4)})`,
            date: parkingSpots.addition_date?.split('T')[0] ?? '',
            parkingType: 'parent',
        });
    }

    if (parkingSpots?.additional_starts) {
        parkingSpots.additional_starts.forEach((spot, index) => {
            rows.push({
                id: `addition-${index}`,
                label: `#${parkingSpots.latitude ? 2 + index : 1 + index}`,
                coords: `(${spot.latitude.toFixed(4)}, ${spot.longitude.toFixed(4)})`,
                date: spot.addition_date?.split('T')[0] ?? '',
                parkingType: 'addition',
                parkingId: spot.id ?? undefined,
            });
        });
    }

    return (
        <>
            {hasWritePrivilege && (
                <div className="flex justify-end mb-4">
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAdd}
                    >
                        Tilføj ekstra punkt
                    </Button>
                </div>
            )}
            <Card variant="outlined">
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Parkeringspunkt</TableCell>
                                <TableCell align="right">Koordinator</TableCell>
                                <TableCell align="right">Tilføjet</TableCell>
                                <TableCell align="right" sx={{ width: 60 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>{row.label}</TableCell>
                                    <TableCell align="right">{row.coords}</TableCell>
                                    <TableCell align="right">{row.date}</TableCell>
                                    <TableCell align="right">
                                        {hasWritePrivilege && (
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setConfirmDeletionInfo({ open: true, parkingType: row.parkingType, parkingId: row.parkingId })}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>
            {confirmDeletionInfo.open && (
                <ConfirmDeletion
                    open={confirmDeletionInfo.open}
                    parkingType={confirmDeletionInfo.parkingType}
                    parkingId={confirmDeletionInfo.parkingId}
                    setOpen={(open) => setConfirmDeletionInfo({ ...confirmDeletionInfo, open })}
                    handleDelete={handleDelete}
                />
            )}
        </>
    )
}
