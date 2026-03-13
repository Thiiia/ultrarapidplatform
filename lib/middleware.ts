// Handles authentication and authorization for protected routes. Checks if users are logged in correctly and redirects if they are not.
import { NextRequest, NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/permissions";
import type { UserRole } from "@/lib/schemas";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get("role")?.value as UserRole | undefined;

  if (!role) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(role, pathname)) {
    const homeUrl = req.nextUrl.clone();

    if (role === "teacher") {
      homeUrl.pathname = "/teacher";
    } else if (role === "student") {
      homeUrl.pathname = "/student";
    } else {
      homeUrl.pathname = "/";
    }

    homeUrl.searchParams.set("denied", pathname);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/teacher/:path*",
    "/student/:path*",
    "/editor/:path*",
    "/launch/:path*",
    "/admin/:path*",
  ],
};