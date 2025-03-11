import { AuthOptions } from 'next-auth';
import KeycloakProvider from 'next-auth/providers/keycloak';
import jwt_decode from 'jwt-decode';
import { updateUserLogin } from "@/components/hooks/patchLogin";

interface DecodedToken {
  privileges_b64: string;
  [key: string]: any;
}

export const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.providerAccountId = account.providerAccountId;
      }

      if (account?.id_token) {
        const decoded = jwt_decode<DecodedToken>(account.id_token);

        try {
          if (token.providerAccountId) {
            updateUserLogin(token.providerAccountId);
          }
        } catch (error) {
          console.error(error);
        }

        token.roleValue = decoded.privileges_b64;
      }

      if (token.roleValue) {
        const decodedRoles = Buffer.from(token.roleValue, 'base64').toString('utf8');

        if (process.env.ROLE_CHECK) {
          token.role_valid = decodedRoles.includes(process.env.ROLE_CHECK);
          token.write_privilege = token.role_valid;
        }

        if (process.env.ROLE_CHECK_READ && !token.role_valid) {
          token.role_valid = decodedRoles.includes(process.env.ROLE_CHECK_READ);
          token.write_privilege = false;
        }

        if (!process.env.ROLE_CHECK && !process.env.ROLE_CHECK_READ) {
          token.role_valid = true;
          token.write_privilege = true;
        }
      } else {
        token.role_valid = false;
        token.write_privilege = false;
      }

      return token;
    },
    session({ session, token }) {
      session.user.roleValue = token.roleValue;
      session.user.role_valid = token.role_valid;
      session.user.write_privilege = token.write_privilege ?? false;
      session.user.providerAccountId = token.providerAccountId;

      return session;
    },
  },
};
