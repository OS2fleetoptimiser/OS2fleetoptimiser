'use client';

import CreateVehicleHierarchy from '@/app/(logged-in)/configuration/CreateVehicleHierarchy';
import DeleteRoundTrips from '@/app/(logged-in)/configuration/DeleteRoundTrips';
import ApiError from '@/components/ApiError';
import useGetDropDownData from '@/components/hooks/useGetDropDownData';
import useGetVehicles from '@/components/hooks/useGetVehicles';
import { Skeleton } from '@mui/material';
import PageTitle from '@/components/PageTitle';
import { useState } from 'react';
import VehicleTable from './ConfigTable';

export default function Page() {
    const [showDeleteRoundtripsModal, setShowDeleteRoundtripsModal] = useState(false);
    const [showCreateHierarchyModal, setShowCreateHierarchyModal] = useState(false);
    const tableData = useGetVehicles();
    const dropDownValues = useGetDropDownData();

    return (
        <>
            <PageTitle
                title="Køretøjer"
                subtitle="Ret oplysninger om indregistrerede køretøjer og tilføj nye køretøjer til simuleringsværktøjerne. Kommatal skal skrives i engelsk format (punktum i stedet for komma)."
            />
            {tableData.isError ? (
                <ApiError retryFunction={tableData.refetch}>Bil data kunne ikke hentes</ApiError>
            ) : dropDownValues.isError ? (
                <ApiError retryFunction={dropDownValues.refetch}>Meta Data kunne ikke hentes</ApiError>
            ) : tableData.isPending || dropDownValues.isPending ? (
                <div>
                    <Skeleton variant="rounded" height={52} sx={{ mb: 1 }} />
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} variant="text" height={36} sx={{ mb: 0.5 }} />
                    ))}
                </div>
            ) : (
                <div>
                    <VehicleTable dropDownData={dropDownValues.data} vehicleData={tableData.data?.vehicles} onDeleteRoundTrips={() => setShowDeleteRoundtripsModal(true)} />
                    <DeleteRoundTrips open={showDeleteRoundtripsModal} onClose={() => setShowDeleteRoundtripsModal(false)} />
                    <CreateVehicleHierarchy open={showCreateHierarchyModal} onClose={() => setShowCreateHierarchyModal(false)} />
                </div>
            )}
        </>
    );
}
