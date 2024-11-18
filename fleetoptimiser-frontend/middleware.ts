import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (process.env.ROLE_CHECK) {
        if (token && token.role_valid) {
            return NextResponse.next();
        } else {
            const mes = token ? 'invalidrole' : 'notoken';
            return NextResponse.redirect(new URL(`/login?message=${mes}`, req.url));
        }
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth/signin/keycloak|api/auth/callback/keycloak).*)'],
};
