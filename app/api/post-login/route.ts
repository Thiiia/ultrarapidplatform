import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function GET(request: Request) {
  const user = await getCurrentAppUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user.role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (user.role === "teacher") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }

  return NextResponse.redirect(new URL("/student", request.url));
}