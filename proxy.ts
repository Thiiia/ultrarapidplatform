import { getAuth0 } from "@/lib/auth0";
import { NextResponse } from "next/server";

export async function proxy(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  // Allow Unity static assets to bypass Auth0 middleware
  if (
    pathname.startsWith("/unity/Build/") ||
    pathname.startsWith("/unity/StreamingAssets/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  return await getAuth0().middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|unity/Build|unity/StreamingAssets).*)",
  ],
};