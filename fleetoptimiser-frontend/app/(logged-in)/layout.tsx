import { env } from '../env';
import TopNavigation from './TopNavigation';
import AppBreadcrumbs from '@/components/Breadcrumbs';

export default function LoggedInLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <TopNavigation logoutRedirect={`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(env.BETTER_AUTH_URL ?? 'http://localhost:3000')}&client_id=${env.KEYCLOAK_ID ?? ''}`} />
            <div className="md:ml-76 h-screen flex flex-col">
                <main className="flex-1 overflow-auto p-4 tiny:pl-16 tiny:pr-16 px-2 text">
                    <AppBreadcrumbs />
                    {children}
                </main>
            </div>
        </>
    );
}
