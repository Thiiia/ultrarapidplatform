import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { getEditorSongChoices, getSongChoices } from "@/lib/song-storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity");
    const context = searchParams.get("context");
    const currentUser = await getCurrentAppUser();

    const songs =
      context === "editor"
        ? await getEditorSongChoices(activity, { userId: currentUser?.id ?? null })
        : await getSongChoices(activity, { userId: currentUser?.id ?? null });

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

