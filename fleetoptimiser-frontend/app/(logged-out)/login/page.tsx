'use client';

import { Alert, Button } from '@mui/material';
import React from 'react';
import Image from 'next/image';
import logo from '../../../public/logo_shadows.svg';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

export default function Page() {
    const searchParams = useSearchParams();
    const message = searchParams.get('message');

    const handleLogin = async () => {
        await signIn.oauth2({
            providerId: "keycloak",
            callbackURL: "/",
            scopes: ["openid", "email", "profile"],
        });
    };

    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="flex flex-col justify-center items-center shadow-md h-80 w-72 bg-white p-6">
                <Image alt="logo" src={logo} width={0} height={0} className="w-full h-auto"></Image>
                <h1 className="text-3xl mb-4 font-bold">FleetOptimiser</h1>
                <Button variant="contained" onClick={handleLogin}>
                    Login
                </Button>
                {message === 'invalidrole' && <Alert severity="error">Du har ikke en godkendt FleetOptimiser rolle.</Alert>}
            </div>
        </div>
    );
}
