import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const COMBINED_API_URL =
  process.env.COMBINED_API_URL || process.env.NEXT_PUBLIC_COMBINED_API_URL || "";

export async function POST(req: Request) {
  try {
    if (!COMBINED_API_URL) {
      return NextResponse.json(
        { error: "Missing COMBINED_API_URL environment variable" },
        { status: 500 }
      );
    }

    const incomingFormData = await req.formData();
    const audioFile = incomingFormData.get("audio_file");

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "audio_file is required" },
        { status: 400 }
      );
    }

    const forwardFormData = new FormData();
    forwardFormData.append("audio_file", audioFile, audioFile.name);

    const response = await fetch(`${COMBINED_API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: forwardFormData,
      redirect: "follow",
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const bodyText = await response.text();

    return new Response(bodyText, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (error) {
    console.error("Combined analysis proxy failed:", error);
    return NextResponse.json(
      { error: "Proxy request to combined analysis backend failed" },
      { status: 500 }
    );
  }
}