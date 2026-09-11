import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppUser } from "@/lib/current-user";
import {
  PlayerWorkspaceKeySchema,
  PlayerWorkspacePayloadSchema,
  WORKSPACE_MAX_BYTES,
  WorkspaceMutationSchema,
} from "@/lib/player-workspace-contract";

const MAX_WRITES_PER_MINUTE = 60;

function keyFromRequest(request: Request) {
  return PlayerWorkspaceKeySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
}

async function limited(userId: string) {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  return prisma.$transaction(async (tx) => {
    const current = await tx.playerWriteRateLimit.findUnique({ where: { userId_action: { userId, action: "workspace" } } });
    if (!current || current.windowStart.getTime() !== windowStart.getTime()) {
      await tx.playerWriteRateLimit.upsert({ where: { userId_action: { userId, action: "workspace" } }, create: { userId, action: "workspace", windowStart, count: 1 }, update: { windowStart, count: 1 } });
      return false;
    }
    if (current.count >= MAX_WRITES_PER_MINUTE) return true;
    await tx.playerWriteRateLimit.update({ where: { id: current.id }, data: { count: { increment: 1 } } });
    return false;
  });
}

function safeWorkspace(record: { songAssetId: string; activityKey: string; authorId: string; revision: string; version: number; payload: unknown; updatedAt: Date }) {
  const payload = PlayerWorkspacePayloadSchema.parse(record.payload);
  return { key: { songAssetId: record.songAssetId, activityKey: record.activityKey, authorId: record.authorId, revision: record.revision }, version: record.version, payload, updatedAt: record.updatedAt.toISOString() };
}

async function sourceRevisionExists(key: { songAssetId: string; activityKey: string; authorId: string; revision: string }) {
  const source = await prisma.gameContentRevision.findFirst({
    where: { revision: key.revision, songAssetId: key.songAssetId, activityKey: key.activityKey, authorId: key.authorId, status: "ready" },
    select: { revision: true },
  });
  return source !== null;
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const key = keyFromRequest(request);
    if (!(await sourceRevisionExists(key))) return NextResponse.json({ error: "Lesson revision not found" }, { status: 404 });
    const record = await prisma.playerLessonWorkspace.findUnique({
      where: { userId_songAssetId_activityKey_authorId_revision: { userId: user.id, ...key } },
    });
    return NextResponse.json(record ? safeWorkspace(record) : { key, version: 0, payload: null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    if (await limited(user.id)) return NextResponse.json({ error: "Too many workspace writes" }, { status: 429, headers: { "Retry-After": "60" } });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > WORKSPACE_MAX_BYTES + 2_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    const mutation = WorkspaceMutationSchema.parse(JSON.parse(raw));
    const { key, expectedVersion, payload } = mutation;
    if (!(await sourceRevisionExists(key))) return NextResponse.json({ error: "Lesson revision not found" }, { status: 404 });
    const result = await prisma.$transaction(async (tx) => {
      if (expectedVersion === 0) {
        return tx.playerLessonWorkspace.create({ data: { userId: user.id, ...key, version: 1, payload: payload as Prisma.InputJsonValue } });
      }
      const updated = await tx.playerLessonWorkspace.updateMany({
        where: { userId: user.id, ...key, version: expectedVersion },
        data: { payload: payload as Prisma.InputJsonValue, version: { increment: 1 } },
      });
      if (updated.count !== 1) return null;
      return tx.playerLessonWorkspace.findUnique({ where: { userId_songAssetId_activityKey_authorId_revision: { userId: user.id, ...key } } });
    });
    if (!result) {
      const current = await prisma.playerLessonWorkspace.findUnique({ where: { userId_songAssetId_activityKey_authorId_revision: { userId: user.id, ...key } } });
      return NextResponse.json({ error: "Workspace version conflict", current: current ? safeWorkspace(current) : null }, { status: 409 });
    }
    return NextResponse.json(safeWorkspace(result));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    if (await limited(user.id)) return NextResponse.json({ error: "Too many workspace writes" }, { status: 429, headers: { "Retry-After": "60" } });
    const key = keyFromRequest(request);
    await prisma.playerLessonWorkspace.deleteMany({ where: { userId: user.id, ...key } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
