import { createAuthClient } from "better-auth/react";
import { genericOAuthClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [genericOAuthClient(), inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, useSession } = authClient;
