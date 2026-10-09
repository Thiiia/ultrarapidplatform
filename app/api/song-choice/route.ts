import { NextResponse } from "next/server";
import {
  DEV_AUTHOR_FOLDER,
  findAuthorByName,
  findDevAuthor,
  getEditorSongChoices,
  getSongChartAuthors,
  getSongChoices,
} from "@/lib/song-storage";
import { getCurrentAppUser } from "@/lib/current-user";
import { canReadEditorAuthor } from "@/lib/lesson-save-authorization";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get("activity");
    const context = searchParams.get("context");
    const user = await getCurrentAppUser().catch(() => null);
    const demoAuthor = await findDevAuthor();

    if (context === "authors") {
      const allAuthors = await getSongChartAuthors();
      const authors = allAuthors.filter((author) =>
        canReadEditorAuthor(user, author.id, demoAuthor?.id),
      );

      if (demoAuthor && !authors.some((author) => author.id === demoAuthor.id)) {
        authors.push({
          id: demoAuthor.id,
          name: demoAuthor.name?.trim() || demoAuthor.email || DEV_AUTHOR_FOLDER,
          email: demoAuthor.email,
          chartCount: 0,
        });
      }
      if (user && !authors.some((author) => author.id === user.id)) {
        authors.push({
          id: user.id,
          name: user.name?.trim() || user.email,
          email: user.email,
          chartCount: 0,
        });
      }

      return NextResponse.json({ authors });
    }

    // Editor context targets a specific author via ?author=<name> (plaintext,
    // e.g. "dev"/"Felix"); without one it defaults to the shared dev author.
    const requestedAuthorName =
      context === "editor"
        ? searchParams.get("author")?.trim() || null
        : null;

    if (context === "editor") {
      const authorName = requestedAuthorName ?? DEV_AUTHOR_FOLDER;
      const targetAuthor = authorName === DEV_AUTHOR_FOLDER
        ? demoAuthor ?? await findAuthorByName(authorName)
        : await findAuthorByName(authorName);
      if (!canReadEditorAuthor(user, targetAuthor?.id, demoAuthor?.id)) {
        return NextResponse.json({ error: "You cannot open another author's private draft." }, { status: 403 });
      }
    }

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
        error: "Unable to load song choices. Please try again.",
      },
      { status: 500 },
    );
  }
}
