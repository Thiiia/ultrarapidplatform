import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentAppUser } from "@/lib/current-user";

const CalibrationKey = z.string().uuid();
const CalibrationMutation = z.object({
  installationId: CalibrationKey,
  offsetMs: z.number().int().min(-350).max(350),
  protocolVersion: z.number().int().positive().max(32),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const installationId = CalibrationKey.parse(new URL(request.url).searchParams.get("installationId"));
    const record = await prisma.playerDeviceCalibration.findUnique({ where: { userId_installationId: { userId: user.id, installationId } } });
    return NextResponse.json(record ? { installationId: record.installationId, offsetMs: record.offsetMs, protocolVersion: record.protocolVersion, calibratedAt: record.calibratedAt.toISOString() } : null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const body = CalibrationMutation.parse(await request.json());
    const record = await prisma.playerDeviceCalibration.upsert({
      where: { userId_installationId: { userId: user.id, installationId: body.installationId } },
      create: { userId: user.id, ...body, calibratedAt: new Date() },
      update: { offsetMs: body.offsetMs, protocolVersion: body.protocolVersion, calibratedAt: new Date() },
    });
    return NextResponse.json({ installationId: record.installationId, offsetMs: record.offsetMs, protocolVersion: record.protocolVersion, calibratedAt: record.calibratedAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireCurrentAppUser();
    const installationId = CalibrationKey.parse(new URL(request.url).searchParams.get("installationId"));
    await prisma.playerDeviceCalibration.deleteMany({ where: { userId: user.id, installationId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bad request" }, { status: 400 });
  }
}
