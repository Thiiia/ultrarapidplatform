import { NextResponse } from "next/server";
import { getSongChoices } from "@/lib/song-storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity");
    const songs = await getSongChoices(activity);

    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Unable to load song choices:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load song choices",
      },
      { status: 500 },
    );
  }
}
