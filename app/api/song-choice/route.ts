import { NextResponse } from "next/server";
import {
  DEV_AUTHOR_FOLDER,
  getEditorSongChoices,
  getSongChartAuthors,
  getSongChoices,
} from "@/lib/song-storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity");
    const context = searchParams.get("context");

    if (context === "authors") {
      const authors = await getSongChartAuthors();

      return NextResponse.json({ authors });
    }

    // Editor context targets a specific author via ?author=<name> (plaintext,
    // e.g. "dev"/"Felix"); without one it defaults to the shared dev author.
    const requestedAuthorName =
      context === "editor"
        ? searchParams.get("author")?.trim() || null
        : null;

    const songs =
      context === "editor"
        ? await getEditorSongChoices(activity, {
            authorName: requestedAuthorName ?? DEV_AUTHOR_FOLDER,
          })
        : await getSongChoices(activity);

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

