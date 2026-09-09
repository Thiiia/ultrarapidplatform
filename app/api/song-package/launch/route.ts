import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveFreshSongLaunchPackage } from "@/lib/song-launch-package";
import {
  DEV_AUTHOR_FOLDER,
  findAuthorByName,
  findDevAuthor,
} from "@/lib/song-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveRequestedAuthor } from "@/lib/song-author";
import {
  buildAuthoredChartStoragePaths,
  type SongActivityKey,
} from "@/lib/song-activity-storage";

function resolveAuthorFolder(user: { name: string | null; email: string | null } | null) {
  if (!user) return DEV_AUTHOR_FOLDER;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return DEV_AUTHOR_FOLDER;
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

async function createSignedUrl(bucket: string, path: string) {
  const info = await getSupabaseAdmin().storage.from(bucket).info(path);
  if (info.error || !info.data) throw new Error(`Required asset unavailable: ${bucket}/${path}`);
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(path, 5 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Unable to load required song asset: ${error?.message ?? "Unknown error"}`);
  }

  return data.signedUrl;
}


/**
 * Absolute URL of the blank chart/sidecar endpoint. Used in place of a signed
 * storage URL when the dev author has not authored a chart for this song +
 * activity yet, so every consumer (lesson editor hydration, game launch) can
 * still fetch a complete package without anything being persisted.
 */
function buildBlankAssetUrl(request: Request, kind: "chart" | "sidecar", activityKey: string) {
  const url = new URL("/api/song-package/blank", request.url);
  url.searchParams.set("kind", kind);
  url.searchParams.set("activity", activityKey);

  return url.toString();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      songAssetId?: unknown;
      activityKey?: unknown;
      authorId?: unknown;
      authorName?: unknown;
      revision?: unknown;
      allowBlankPackage?: unknown;
    };
    const songAssetId = readRequiredString(payload.songAssetId, "songAssetId");
    const activityKey = readRequiredString(payload.activityKey, "activityKey");
    const requestedAuthorId =
      typeof payload.authorId === "string" && payload.authorId.trim()
        ? payload.authorId.trim()
        : null;
    const requestedAuthorName =
      typeof payload.authorName === "string" && payload.authorName.trim()
        ? payload.authorName.trim()
        : null;
    const requestedRevision =
      typeof payload.revision === "string" && payload.revision.trim()
        ? payload.revision.trim()
        : null;
    const author = await resolveRequestedAuthor({
      authorId: requestedAuthorId,
      authorName: requestedAuthorName,
      findById: async (id) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true } }),
      findByName: async (name) => {
        const user = await findAuthorByName(name);
        return user ? { id: user.id, name: user.name } : null;
      },
      getDefault: async () => {
        const user = await findDevAuthor();
        return user ? { id: user.id, name: user.name } : null;
      },
    });
    if (!author) {
      throw new Error("No default author is configured");
    }
    const authorFolder = resolveAuthorFolder({ name: author.name, email: null });

    const songPackage = await resolveFreshSongLaunchPackage({
      songAssetId,
      activityKey,
      authorId: author.id,
      revision: requestedRevision,
      allowBlankPackage: payload.allowBlankPackage === true && !requestedRevision,
      loadSongAsset: async (id) =>
        prisma.songAsset.findUnique({
          where: { id },
          select: {
            id: true,
            isActive: true,
            songBucket: true,
            songPath: true,
          },
        }) as Promise<Record<string, unknown> | null>,
      loadSongChart: async (assetId, resolvedActivityKey, authorId) => {
        if (!authorId) return null;
        const revision = await prisma.gameContentRevision.findFirst({
          where: {
            songAssetId: assetId,
            activityKey: resolvedActivityKey,
            authorId,
            status: "ready",
            ...(requestedRevision ? { revision: requestedRevision } : {}),
          },
          orderBy: { publishedAt: "desc" },
          select: {
            revision: true, chartBucket: true, chartPath: true, sidecarBucket: true, sidecarPath: true,
            chartSha256: true, sidecarSha256: true, audioSha256: true,
            equationCount: true, encounterCount: true, targetCount: true,
          },
        });
        if (!revision || !revision.chartSha256 || !revision.sidecarSha256 || !revision.audioSha256 ||
          revision.equationCount == null || revision.encounterCount == null || revision.targetCount == null) return null;
        return {
          chartBucket: revision.chartBucket,
          chartPath: revision.chartPath,
          sidecarBucket: revision.sidecarBucket,
          sidecarPath: revision.sidecarPath,
          authorId,
          revision: revision.revision,
          counts: { equations: revision.equationCount, encounters: revision.encounterCount, targets: revision.targetCount },
          hashes: { chartSha256: revision.chartSha256, sidecarSha256: revision.sidecarSha256, audioSha256: revision.audioSha256 },
        };
      },
      loadBlankSongChart: async (assetId, resolvedActivityKey) => {
        // No authored chart yet: serve blank chart/sidecar content under the
        // prospective author storage paths. The database entry (and storage
        // objects) are only created when the user saves.
        const blankActivityKey = resolvedActivityKey as SongActivityKey;
        const paths = buildAuthoredChartStoragePaths({
          activityKey: blankActivityKey,
          songAssetId: assetId,
          authorFolder,
        });

        return {
          chart: {
            bucket: "Charts",
            path: paths.chartPath,
            signedUrl: buildBlankAssetUrl(request, "chart", blankActivityKey),
          },
          sidecar: {
            bucket: "SidecarJsons",
            path: paths.sidecarPath,
            signedUrl: buildBlankAssetUrl(request, "sidecar", blankActivityKey),
          },
        };
      },
      createSignedUrl,
    });

    return NextResponse.json(songPackage, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load song package" },
      { status: 400 },
    );
  }
}
