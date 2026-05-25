import { supabaseAdmin } from "@/lib/supabase-admin";

export type SongChoice = {
  id: string;
  name: string;
  path: string;
  signedUrl: string;
  size: number | null;
  contentType: string | null;
  updatedAt: string | null;
};

const SONG_BUCKET = process.env.SUPABASE_SONG_BUCKET ?? "songs";

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "flac",
  "aac",
  "aiff",
  "aif",
]);

function isAudioFile(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension ? AUDIO_EXTENSIONS.has(extension) : false;
}

function getDisplayName(path: string) {
  const fileName = path.split("/").pop() ?? path;
  return fileName.replace(/\.[^/.]+$/, "");
}

async function listSongPaths(prefix = ""): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(SONG_BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: {
      column: "name",
      order: "asc",
    },
  });

  if (error) {
    throw new Error(`Unable to list songs from Supabase Storage: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  const paths: string[] = [];

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.metadata && isAudioFile(item.name)) {
      paths.push(itemPath);
      continue;
    }

    if (!item.metadata && !item.name.includes(".")) {
      const nestedPaths = await listSongPaths(itemPath);
      paths.push(...nestedPaths);
    }
  }

  return paths;
}

async function getFileMetadata(path: string) {
  const folder = path.split("/").slice(0, -1).join("/");
  const fileName = path.split("/").pop();

  const { data } = await supabaseAdmin.storage
    .from(SONG_BUCKET)
    .list(folder || undefined, {
      search: fileName,
      limit: 1,
    });

  return data?.[0] ?? null;
}

export async function getSongChoices(): Promise<SongChoice[]> {
  const paths = await listSongPaths();

  const songs = await Promise.all(
    paths.map(async (path) => {
      const { data: signedUrlData, error: signedUrlError } =
        await supabaseAdmin.storage.from(SONG_BUCKET).createSignedUrl(path, 60 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(
          `Unable to create signed URL for ${path}: ${
            signedUrlError?.message ?? "Unknown error"
          }`,
        );
      }

      const fileMetadata = await getFileMetadata(path);

      return {
        id: path,
        name: getDisplayName(path),
        path,
        signedUrl: signedUrlData.signedUrl,
        size:
          typeof fileMetadata?.metadata?.size === "number"
            ? fileMetadata.metadata.size
            : null,
        contentType:
          typeof fileMetadata?.metadata?.mimetype === "string"
            ? fileMetadata.metadata.mimetype
            : null,
        updatedAt: fileMetadata?.updated_at ?? null,
      };
    }),
  );

  return songs.sort((a, b) => a.name.localeCompare(b.name));
}