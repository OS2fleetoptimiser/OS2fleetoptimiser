'use client';

import CreateVehicleHierarchy from '@/app/(logged-in)/configuration/CreateVehicleHierarchy';
import DeleteRoundTrips from '@/app/(logged-in)/configuration/DeleteRoundTrips';
import ApiError from '@/components/ApiError';
import useGetDropDownData from '@/components/hooks/useGetDropDownData';
import useGetVehicles from '@/components/hooks/useGetVehicles';
import { Button, CircularProgress } from '@mui/material';
import { Inter } from 'next/font/google';
import { useState } from 'react';
import VehicleTable from './ConfigTable';
import {useWritePrivilegeContext} from "@/app/providers/WritePrivilegeProvider";

const inter = Inter({ subsets: ['latin'] });

export default function Page() {
    const [showDeleteRoundtripsModal, setShowDeleteRoundtripsModal] = useState(false);
    const [showCreateHierarchyModal, setShowCreateHierarchyModal] = useState(false);
    const { hasWritePrivilege } = useWritePrivilegeContext();
    const tableData = useGetVehicles();
    const dropDownValues = useGetDropDownData();

    return (
        <>
            <h2 className="text-3xl mb-2">Flådeoverblik</h2>

            {tableData.isError ? (
                <ApiError retryFunction={tableData.refetch}>Bil data kunne ikke hentes</ApiError>
            ) : dropDownValues.isError ? (
                <ApiError retryFunction={dropDownValues.refetch}>Meta Data kunne ikke hentes</ApiError>
            ) : tableData.isLoading || dropDownValues.isLoading ? (
                <CircularProgress />
            ) : (
                <div>
                    <VehicleTable dropDownData={dropDownValues.data} vehicleData={tableData.data?.vehicles} />
                    <div className="mt-3 space-x-4 flex justify-end">
                        <Button disabled={!hasWritePrivilege} color="primary" onClick={() => setShowDeleteRoundtripsModal(true)} variant="contained">
                            Slet Tur
                        </Button>
                    </div>
                    <DeleteRoundTrips open={showDeleteRoundtripsModal} onClose={() => setShowDeleteRoundtripsModal(false)} />
                    <CreateVehicleHierarchy open={showCreateHierarchyModal} onClose={() => setShowCreateHierarchyModal(false)} />
                </div>
            )}
        </>
    );
}
