import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  HostedUnityCapabilityError,
  loadHostedUnityRuntimeCapabilities,
} from "@/lib/hosted-unity-capability-check";
import { getUnityGameUrl } from "@/lib/unity-game-url";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { code: "FORBIDDEN" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const { manifest } = await loadHostedUnityRuntimeCapabilities(getUnityGameUrl());
    const activities = manifest.activities.map((activity) => ({
      activityKey: activity.activityKey,
      mechanics: [...new Set([
        ...activity.authoredLessonAdapters.flatMap((adapter) => adapter.mechanics),
        ...activity.authoredSequenceAdapters.flatMap((adapter) => adapter.encounterMechanics),
      ])],
    }));

    return NextResponse.json({ activities }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof HostedUnityCapabilityError) {
      const status = error.code === "RUNTIME_CAPABILITY_UNAVAILABLE" ? 503 : 409;
      return NextResponse.json(
        { code: error.code },
        { status, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { code: "RUNTIME_CAPABILITY_UNAVAILABLE" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
