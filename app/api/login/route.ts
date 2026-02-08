import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const role = String(formData.get("role") || "");

  if (role !== "student" && role !== "teacher") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const res = NextResponse.redirect(new URL(role === "teacher" ? "/teacher" : "/student", req.url));

  // Cookie is your "session" for now
  res.cookies.set("role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
