import { z } from "zod";

export const RequiredCalibrationProtocolVersion = 1;
const CalibrationStateSchema = z.object({
  offsetMs: z.number().int().min(-350).max(350),
  protocolVersion: z.number().int().positive().max(32),
}).strict();
export type CalibrationState = z.infer<typeof CalibrationStateSchema>;

export function parseCalibrationState(value: unknown, requiredProtocolVersion = RequiredCalibrationProtocolVersion): CalibrationState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { offsetMs?: unknown; protocolVersion?: unknown };
  const parsed = CalibrationStateSchema.safeParse({
    offsetMs: candidate.offsetMs,
    protocolVersion: candidate.protocolVersion,
  });
  if (!parsed.success || parsed.data.protocolVersion !== requiredProtocolVersion) return null;
  return parsed.data;
}

const BridgeTemplateProvenanceSchema = z.object({
  templateId: z.string().min(1).max(160),
  label: z.string().min(1).max(200),
  origin: z.literal("verified-starter-template"),
  sourceRevision: z.string().min(1).max(160),
}).strict();

export const BridgeReceiptSchema = z.object({
  receiptVersion: z.literal(1),
  contractVersion: z.literal(1),
  songAssetId: z.string().min(1).max(160),
  activityKey: z.string().min(1).max(80),
  authorId: z.string().min(1).max(160),
  revision: z.string().min(1).max(160),
  source: z.enum(["authored", "starter-template"]),
  templateProvenance: BridgeTemplateProvenanceSchema.optional(),
  runtimeCapabilities: z.array(z.string().min(1).max(80)).min(1).max(16),
  rhythmDifficultyKey: z.enum(["EasySingle", "MediumSingle", "HardSingle", "ExpertSingle"]).optional(),
  learningDifficultyKey: z.string().min(1).max(80).optional(),
  launchAttemptId: z.string().uuid(),
  chart: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  sidecar: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  audio: z.object({ bucket: z.string().min(1).max(80), path: z.string().min(1).max(500) }).strict(),
  counts: z.object({ encounters: z.number().int().nonnegative(), equations: z.number().int().nonnegative(), targets: z.number().int().nonnegative() }).strict(),
  hashes: z.object({ chartSha256: z.string().regex(/^[a-f0-9]{64}$/i), sidecarSha256: z.string().regex(/^[a-f0-9]{64}$/i), audioSha256: z.string().regex(/^[a-f0-9]{64}$/i) }).strict(),
}).strict();

const CompletionAggregateShape = {
  outcome: z.enum(["completed", "failed", "abandoned", "cancelled"]),
  completedEvents: z.number().int().min(0).max(10_000),
  requiredEvents: z.number().int().min(0).max(10_000),
  solvedSets: z.number().int().min(0).max(10_000),
  hitAttempts: z.number().int().min(0).max(100_000),
};

const AlgebraMissionStepSchema = z.object({
  recordType: z.enum(["performance", "equation-transition", "authored-judgement", "encounter-result"]),
  equationId: z.string().min(1).max(120),
  encounterId: z.string().max(120),
  mechanic: z.string().max(16),
  stepIndex: z.number().int().min(1).max(10_000),
  slotIndex: z.number().int().min(-1).max(31),
  judgement: z.enum(["none", "perfect", "good", "early", "late", "miss", "solved", "failed", "cancelled", "activated", "completed"]),
  hasTimingError: z.boolean(),
  signedErrorMs: z.number().finite().min(-120_000).max(120_000),
  fromEquation: z.string().max(240),
  toEquation: z.string().max(240),
  operation: z.string().max(64),
  equationProgress: z.number().finite().min(0).max(1),
  performanceOutcomes: z.array(z.enum(["perfect", "good", "early", "late", "miss"])).max(32),
  recordedAtUtc: z.string().min(1).max(40),
}).strict();
export type AlgebraMissionStep = z.infer<typeof AlgebraMissionStepSchema>;

const PlatformPlayerCompletionV2Schema = z.object({
  completionVersion: z.literal(2),
  ...CompletionAggregateShape,
}).strict();

const PlatformPlayerCompletionV3Schema = z.object({
  completionVersion: z.literal(3),
  ...CompletionAggregateShape,
  missionSteps: z.array(AlgebraMissionStepSchema).min(1).max(512),
}).strict();

function validateCompletionAggregates(
  completion: { outcome: string; completedEvents: number; requiredEvents: number; solvedSets: number },
  context: z.RefinementCtx,
) {
  if (completion.completedEvents > completion.requiredEvents) {
    context.addIssue({ code: "custom", path: ["completedEvents"], message: "Completed events cannot exceed required events." });
  }
  if (completion.solvedSets > completion.completedEvents) {
    context.addIssue({ code: "custom", path: ["solvedSets"], message: "Solved sets cannot exceed completed events." });
  }
  if (completion.outcome === "completed" && (
    completion.requiredEvents === 0 ||
    completion.completedEvents !== completion.requiredEvents ||
    completion.solvedSets === 0
  )) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Completed outcomes require all authored events and at least one solved set." });
  }
}

export const PlatformPlayerCompletionSchema = z.discriminatedUnion("completionVersion", [
  PlatformPlayerCompletionV2Schema,
  PlatformPlayerCompletionV3Schema,
]).superRefine(validateCompletionAggregates);
export type PlatformPlayerCompletion = z.infer<typeof PlatformPlayerCompletionSchema>;

export const PlatformPlayerBridgeMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("calibration-complete"), nonce: z.string().uuid(), receipt: BridgeReceiptSchema, offsetMs: z.number().int().min(-350).max(350), protocolVersion: z.number().int().positive().max(32) }).strict(),
  z.object({ type: z.literal("run-complete"), nonce: z.string().uuid(), receipt: BridgeReceiptSchema, completion: PlatformPlayerCompletionSchema }).strict(),
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
  if (!parsed.success || parsed.data.nonce !== active.nonce || canonicalJson(parsed.data.receipt) !== canonicalJson(active.receipt)) {
    return { ok: false as const };
  }
  if (parsed.data.type === "calibration-complete" && parsed.data.protocolVersion !== active.protocolVersion) {
    return { ok: false as const };
  }
  return { ok: true as const, message: parsed.data };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function getOrCreateInstallationId(storage: Pick<Storage, "getItem" | "setItem">) {
  const existing = storage.getItem("ultrarapid-installation-id");
  if (existing && z.string().uuid().safeParse(existing).success) return existing;
  const id = crypto.randomUUID();
  storage.setItem("ultrarapid-installation-id", id);
  return id;
}

export function needsCalibration(value: unknown, requiredProtocolVersion = RequiredCalibrationProtocolVersion) {
  return parseCalibrationState(value, requiredProtocolVersion) === null;
}
