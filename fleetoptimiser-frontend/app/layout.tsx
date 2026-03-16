import './globals.css';
import ProviderWrapper from './providers/providerWrapper';
import React from 'react';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppTheme from '@/theme';
import { WritePrivilegeProvider } from '@/app/providers/WritePrivilegeProvider';
import SetWritePrivilege from '@/app/providers/setWritePrivilege';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

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
            <body id="__next" className={inter.className}>
                <ProviderWrapper>
                    <WritePrivilegeProvider>
                        <SetWritePrivilege hasPrivilege={doesUserHaveWritePrivilege} />
                        <AppTheme>
                            <main>{children}</main>
                        </AppTheme>
                    </WritePrivilegeProvider>
                </ProviderWrapper>
            </body>
        </html>
    );
}
