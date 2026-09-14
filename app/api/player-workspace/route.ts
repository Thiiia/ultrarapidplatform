import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppUser } from "@/lib/current-user";
import {
  PlayerWorkspaceKeySchema,
  PlayerWorkspacePayloadSchema,
  WORKSPACE_MAX_BYTES,
  WorkspaceMutationSchema,
} from "@/lib/player-workspace-contract";

const MAX_WRITES_PER_MINUTE = 60;

function errorResponse(status: number, code: string, message: string, paths?: string[], headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message, ...(paths && paths.length > 0 ? { paths } : {}) } }, { status, headers });
}

function validationResponse(error: ZodError) {
  const paths = error.issues
    .map((issue) => issue.path.join("."))
    .map((path) => path || "payload")
    .filter((path, index, all) => all.indexOf(path) === index)
    .slice(0, 12);
  const message = error.issues[0]?.message ?? "Workspace payload failed validation.";
  return errorResponse(422, "invalid_workspace_payload", message, paths);
}

function unexpectedResponse() {
  return errorResponse(500, "workspace_unavailable", "The private workspace is temporarily unavailable.");
}

function safeCaughtResponse(error: unknown) {
  if (error instanceof Error && error.message === "User is not authenticated.") {
    return errorResponse(401, "unauthorized", "Sign in is required to sync this private workspace.");
  }
  if (error instanceof ZodError) return validationResponse(error);
  return unexpectedResponse();
}

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
    if (!(await sourceRevisionExists(key))) return errorResponse(404, "lesson_revision_not_found", "The lesson revision was not found.");
    const record = await prisma.playerLessonWorkspace.findUnique({
      where: { userId_songAssetId_activityKey_authorId_revision: { userId: user.id, ...key } },
    });
    return NextResponse.json(record ? safeWorkspace(record) : { key, version: 0, payload: null });
  } catch (error) {
    return safeCaughtResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    if (await limited(user.id)) return errorResponse(429, "rate_limited", "Workspace writes are temporarily rate limited.", undefined, { "Retry-After": "60" });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > WORKSPACE_MAX_BYTES + 2_000) return errorResponse(413, "payload_too_large", "The private workspace payload is too large.");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "The workspace request was not valid JSON.");
    }
    const parsedMutation = WorkspaceMutationSchema.safeParse(parsedJson);
    if (!parsedMutation.success) return validationResponse(parsedMutation.error);
    const mutation = parsedMutation.data;
    const { key, expectedVersion, payload } = mutation;
    if (!(await sourceRevisionExists(key))) return errorResponse(404, "lesson_revision_not_found", "The lesson revision was not found.");
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
      return NextResponse.json({ error: { code: "workspace_version_conflict", message: "The workspace changed elsewhere." }, current: current ? safeWorkspace(current) : null }, { status: 409 });
    }
    return NextResponse.json(safeWorkspace(result));
  } catch (error) {
    return safeCaughtResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    if (await limited(user.id)) return errorResponse(429, "rate_limited", "Workspace writes are temporarily rate limited.", undefined, { "Retry-After": "60" });
    const key = keyFromRequest(request);
    await prisma.playerLessonWorkspace.deleteMany({ where: { userId: user.id, ...key } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return safeCaughtResponse(error);
  }
}
