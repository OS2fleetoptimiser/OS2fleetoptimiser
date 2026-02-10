import './globals.css';
import ProviderWrapper from './providers/providerWrapper';
import React from 'react';
import { Metadata } from 'next';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { WritePrivilegeProvider } from '@/app/providers/WritePrivilegeProvider';
import SetWritePrivilege from '@/app/providers/setWritePrivilege';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const metadata: Metadata = {
    title: 'FleetOptimiser',
    description: 'FleetOptimiser is a tool used to simulate fleets of organisations to help identify sizing and booking issues.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    const doesUserHaveWritePrivilege = session?.user?.writePrivilege ?? false;
    return (
        <html lang="da-dk">
            <body id="__next">
                <ProviderWrapper>
                    <WritePrivilegeProvider>
                        <SetWritePrivilege hasPrivilege={doesUserHaveWritePrivilege} />
                        <ThemeProvider theme={theme}>
                            <CssBaseline />
                            <main>{children}</main>
                        </ThemeProvider>
                    </WritePrivilegeProvider>
                </ProviderWrapper>
            </body>
        </html>
    );
}
