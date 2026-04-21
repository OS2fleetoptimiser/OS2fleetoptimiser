'use client';

import { useAppSelector } from '@/components/redux/hooks';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ValueCheckProvider = () => {
    const requiresCarSelection = ['/fleet', '/goal'];

    const selectedCars = useAppSelector((state) => state.simulation.selectedVehicles.length !== 0);
    const currentPath = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!selectedCars && requiresCarSelection.includes(currentPath)) {
            router.push('/');
        }
    }, [selectedCars, currentPath, router]);

    return <></>;
};

export default ValueCheckProvider;
