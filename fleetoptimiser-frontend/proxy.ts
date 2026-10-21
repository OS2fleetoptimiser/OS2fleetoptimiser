import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/fleet");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?message=notoken", req.url));
  }

  if (process.env.ROLE_CHECK && !session.user.roleValid) {
    if (isApi) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?message=invalidrole", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)",
  ],
};
