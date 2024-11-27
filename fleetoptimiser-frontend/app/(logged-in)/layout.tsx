import { env } from '../env';
import TopNavigation from './TopNavigation';
import InfoNav from '@/app/(logged-in)/InfoNavigation';

export default function LoggedInLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <TopNavigation logoutRedirect={`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`} />
            <InfoNav />

            <main className="md:ml-76 p-4 pl-16 pr-16 text">{children}</main>
        </>
    );
}
