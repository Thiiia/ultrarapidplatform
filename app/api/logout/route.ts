import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { track } from "@vercel/analytics/server";

type Role = "student" | "teacher" | "admin";

function getEnvironment(): "development" | "preview" | "production" {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const role = cookieStore.get("role")?.value;
  const sessionId = cookieStore.get("session_id")?.value;

  if (
    sessionId &&
    (role === "student" || role === "teacher" || role === "admin")
  ) {
    try {
      await track("logout_completed", {
        role: role as Role,
        session_id: sessionId,
        environment: getEnvironment(),
        app_area: "auth",
        timestamp: new Date().toISOString(),
        success: true,
      });
    } catch (error) {
      console.error("Failed to track logout_completed:", error);
    }
  }

  const res = NextResponse.redirect(new URL("/", req.url));

  res.cookies.set("role", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("session_id", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}