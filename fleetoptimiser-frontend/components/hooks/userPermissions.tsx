import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function checkWritePrivilege() {
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return false;
    }

    return session.user.writePrivilege ?? false;
}
