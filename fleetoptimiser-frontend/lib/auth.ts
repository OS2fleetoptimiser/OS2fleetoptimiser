import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function decodePrivileges(privilegesB64: string | undefined): {
  roleValid: boolean;
  writePrivilege: boolean;
} {
  let roleValid = false;
  let writePrivilege = false;

  if (privilegesB64) {
    const decodedRoles = Buffer.from(privilegesB64, "base64").toString("utf8");

    if (process.env.ROLE_CHECK) {
      roleValid = decodedRoles.includes(process.env.ROLE_CHECK);
      writePrivilege = roleValid;
    }

    if (process.env.ROLE_CHECK_READ && !roleValid) {
      roleValid = decodedRoles.includes(process.env.ROLE_CHECK_READ);
      writePrivilege = false;
    }

    if (!process.env.ROLE_CHECK && !process.env.ROLE_CHECK_READ) {
      roleValid = true;
      writePrivilege = true;
    }
  } else if (!process.env.ROLE_CHECK && !process.env.ROLE_CHECK_READ) {
    roleValid = true;
    writePrivilege = true;
  }

  return { roleValid, writePrivilege };
}

export const auth = betterAuth({
  account: {
    storeAccountCookie: true, // Stateless mode
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "keycloak",
          clientId: process.env.KEYCLOAK_ID!,
          clientSecret: process.env.KEYCLOAK_SECRET!,
          discoveryUrl: `${process.env.KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
          scopes: ["openid", "email", "profile"],
          pkce: true,
          getUserInfo: async (tokens) => {
            const rawResponse = tokens.raw as Record<string, unknown> | undefined;
            const idTokenString = (tokens as { idToken?: string }).idToken ||
                                  (rawResponse?.id_token as string | undefined);

            let claims: Record<string, unknown> = {};
            if (idTokenString) {
              claims = decodeJwtPayload(idTokenString);
            }

            const privilegesB64 = claims.privileges_b64 as string | undefined;
            const { roleValid, writePrivilege } = decodePrivileges(privilegesB64);

            return {
              id: (claims.sub as string) || "",
              email: (claims.email as string) || "",
              name: (claims.name as string) || "",
              emailVerified: (claims.email_verified as boolean) ?? false,
              roleValid,
              writePrivilege,
            };
          },
        },
      ],
    }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      roleValid: { type: "boolean", required: false, defaultValue: false },
      writePrivilege: { type: "boolean", required: false, defaultValue: false },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 1 day (matches updateAge)
      strategy: "compact",  // smallest size, HMAC-signed
    },
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});

export type Session = typeof auth.$Infer.Session;
