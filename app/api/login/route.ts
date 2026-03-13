import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";
import { randomUUID, createHash } from "crypto";

type Role = "student" | "teacher";

function getEnvironment(): "development" | "preview" | "production" {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

function hashUserId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const role = String(formData.get("role") || "") as Role;

  if (role !== "student" && role !== "teacher") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const sessionId = randomUUID();
  const userIdHash = hashUserId(`demo-${role}-${sessionId}`);

  await track("login_completed", {
    role,
    user_id_hash: userIdHash,
    session_id: sessionId,
    environment: getEnvironment(),
    app_area: "auth",
    timestamp: new Date().toISOString(),
    login_method: "role_selector",
    success: true,
  });

  const res = NextResponse.redirect(
    new URL(role === "teacher" ? "/teacher" : "/student", req.url)
  );

  res.cookies.set("role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res;
}