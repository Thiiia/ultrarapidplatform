import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getSongChoices } from "@/lib/song-storage";

export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity");
    const songs = await getSongChoices(activity, user?.id ?? null);

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
