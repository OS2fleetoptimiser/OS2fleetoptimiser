import './globals.css';
import ProviderWrapper from './providers/providerWrapper';
import React from 'react';
import { Metadata } from 'next';
import { Button } from '@mui/material';
import logo from '../public/logo_shadows.svg';
import Image from 'next/image';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from "@/theme";
import { checkWritePrivilege } from "@/components/hooks/userPermissions";
import { WritePrivilegeProvider } from "@/app/providers/WritePrivilegeProvider";
import SetWritePrivilege from "@/app/providers/setWritePrivilege";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = {
    title: 'FleetOptimiser',
    description: 'FleetOptimiser is a tool used to simulate fleets of organisations to help identify sizing and booking issues.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    const doesUserHaveWritePrivilege = await checkWritePrivilege();
    return (
        <html lang="da-dk">
            <body id="__next">
                <ProviderWrapper>
                    <WritePrivilegeProvider>
                        <SetWritePrivilege hasPrivilege={doesUserHaveWritePrivilege} />
                        <ThemeProvider theme={theme}>
                            <CssBaseline />
                            {!session && process.env.NODE_ENV !== 'development' ? (
                                <div className="flex justify-center items-center min-h-screen">
                                    <div className="flex flex-col justify-center items-center shadow-md h-80 w-72 bg-white p-6">
                                        <Image alt="logo" src={logo} width={0} height={0} className="w-full h-auto"></Image>
                                        <h1 className="text-3xl mb-4 font-bold">FleetOptimiser</h1>
                                        <Link href="/login">
                                            <Button variant="contained">Login</Button>
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <main>{children}</main>
                            )}
                        </ThemeProvider>
                    </WritePrivilegeProvider>
                </ProviderWrapper>
            </body>
        </html>
    );
}
