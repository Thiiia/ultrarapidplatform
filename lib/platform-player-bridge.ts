import { z } from "zod";

export const BridgeReceiptSchema = z.object({
  receiptVersion: z.literal(1),
  songAssetId: z.string().min(1).max(160),
  activityKey: z.string().min(1).max(80),
  authorId: z.string().min(1).max(160),
  revision: z.string().min(1).max(160).optional(),
  chart: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  sidecar: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  audio: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  counts: z.object({ encounters: z.number().int().nonnegative(), equations: z.number().int().nonnegative(), targets: z.number().int().nonnegative() }).strict(),
  hashes: z.object({ chartSha256: z.string().regex(/^[a-f0-9]{64}$/i), sidecarSha256: z.string().regex(/^[a-f0-9]{64}$/i), audioSha256: z.string().regex(/^[a-f0-9]{64}$/i) }).strict(),
}).strict();

export const PlatformPlayerBridgeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("calibration-complete"), nonce: z.string().uuid(), receipt: BridgeReceiptSchema, offsetMs: z.number().int().min(-350).max(350), protocolVersion: z.number().int().positive().max(32) }).strict(),
  z.object({ type: z.literal("exit-to-song-select"), nonce: z.string().uuid(), receipt: BridgeReceiptSchema }).strict(),
]);

export type PlatformPlayerBridgeMessage = z.infer<typeof PlatformPlayerBridgeMessageSchema>;
export type BridgeContext = { nonce: string; installationId: string; receipt: z.infer<typeof BridgeReceiptSchema>; origin: string; protocolVersion: number };

export function createBridgeContext(receipt: unknown, gameUrl: string, installationId: string, protocolVersion = 1): BridgeContext {
  const parsedReceipt = BridgeReceiptSchema.parse(receipt);
  const origin = new URL(gameUrl).origin;
  const nonce = crypto.randomUUID();
  return { nonce, installationId, receipt: parsedReceipt, origin, protocolVersion };
}

export function validateBridgeMessage(value: unknown, active: BridgeContext) {
  const parsed = PlatformPlayerBridgeMessageSchema.safeParse(value);
  if (!parsed.success || parsed.data.nonce !== active.nonce || JSON.stringify(parsed.data.receipt) !== JSON.stringify(active.receipt)) {
    return { ok: false as const };
  }
  return { ok: true as const, message: parsed.data };
}

export function getOrCreateInstallationId(storage: Pick<Storage, "getItem" | "setItem">) {
  const existing = storage.getItem("ultrarapid-installation-id");
  if (existing && z.string().uuid().safeParse(existing).success) return existing;
  const id = crypto.randomUUID();
  storage.setItem("ultrarapid-installation-id", id);
  return id;
}

export function needsCalibration(value: { protocolVersion?: number } | null | undefined, requiredProtocolVersion = 1) {
  return !value || value.protocolVersion !== requiredProtocolVersion;
}
