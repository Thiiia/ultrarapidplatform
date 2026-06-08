import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAppUser } from "@/lib/current-user";

type SaveFilePayload = {
  bucket?: unknown;
  path?: unknown;
  content?: unknown;
  contentType?: unknown;
};

type SavePayload = {
  songAssetId?: unknown;
  chart?: SaveFilePayload;
  sidecar?: SaveFilePayload;
};

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value;
}

async function uploadTextFile(file: SaveFilePayload, fallbackContentType: string) {
  const bucket = readRequiredString(file.bucket, "bucket");
  const path = readRequiredString(file.path, "path");
  const content = readRequiredString(file.content, "content");
  const contentType =
    typeof file.contentType === "string" && file.contentType.trim().length > 0
      ? file.contentType
      : fallbackContentType;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.storage.from(bucket).upload(path, content, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as SavePayload;

    if (!payload.chart || !payload.sidecar) {
      return NextResponse.json(
        { error: "Both chart and sidecar payloads are required" },
        { status: 400 },
      );
    }

    await uploadTextFile(payload.chart, "text/plain;charset=utf-8");
    await uploadTextFile(payload.sidecar, "application/json;charset=utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save lesson files" },
      { status: 500 },
    );
  }
}
