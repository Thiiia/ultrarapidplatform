import { z } from "zod";

export const WORKSPACE_MAX_BYTES = 48_000;

const SafeId = z.string().trim().min(1).max(160);
const credentialLikeKeySuffix = /(?:url|token|credential|secret|signature|useragent|ipaddress)$/i;
const EquationTokenSchema = z.object({
  id: SafeId,
  label: z.string().trim().min(1).max(80),
}).strict();

export const SavedEquationSchema = z.object({
  id: SafeId,
  tokens: z.array(EquationTokenSchema).min(1).max(64),
}).strict().superRefine((equation, ctx) => {
  const ids = equation.tokens.map((token) => token.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["tokens"], message: "Equation token IDs must be unique" });
  }
});

export const PlayerWorkspaceKeySchema = z.object({
  songAssetId: SafeId,
  activityKey: z.enum(["number-bonds", "equations", "missing-numbers", "early-algebra"]),
  authorId: SafeId,
  revision: z.string().uuid(),
}).strict();

function containsCredentialLikeValue(value: unknown): boolean {
  if (typeof value === "string") return /https?:\/\/|x-amz-|token=|sig(nature)?=|access[_-]?token|secret/i.test(value);
  if (Array.isArray(value)) return value.some(containsCredentialLikeValue);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => credentialLikeKeySuffix.test(key) || containsCredentialLikeValue(nested));
  }
  return false;
}

export const PlayerTimelineEditSchema = z.record(z.string().min(1).max(80), z.unknown()).superRefine((edit, ctx) => {
  if (containsCredentialLikeValue(edit)) ctx.addIssue({ code: "custom", message: "Timeline edit contains credential-like data" });
});

export const PlayerWorkspacePayloadSchema = z.object({
  version: z.number().int().nonnegative(),
  equations: z.array(SavedEquationSchema).max(100),
  hiddenSourceEquationIds: z.array(SafeId).max(200),
  timelineEdits: z.array(PlayerTimelineEditSchema).max(400),
  tutorial: z.object({ step: z.enum(["welcome", "equation", "encounter", "done"]) }).strict(),
  updatedAt: z.number().int().nonnegative(),
}).strict().superRefine((payload, ctx) => {
  const equationIds = payload.equations.map((equation) => equation.id);
  if (new Set(equationIds).size !== equationIds.length) {
    ctx.addIssue({ code: "custom", path: ["equations"], message: "Equation IDs must be unique" });
  }
  if (new Set(payload.hiddenSourceEquationIds).size !== payload.hiddenSourceEquationIds.length) {
    ctx.addIssue({ code: "custom", path: ["hiddenSourceEquationIds"], message: "Hidden source IDs must be unique" });
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > WORKSPACE_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: "Workspace payload is too large" });
  }
});

export const WorkspaceMutationSchema = z.object({
  key: PlayerWorkspaceKeySchema,
  expectedVersion: z.number().int().nonnegative(),
  payload: PlayerWorkspacePayloadSchema,
}).strict();

export type PlayerWorkspaceKey = z.infer<typeof PlayerWorkspaceKeySchema>;
export type PlayerWorkspacePayload = z.infer<typeof PlayerWorkspacePayloadSchema>;
export type WorkspaceMutation = z.infer<typeof WorkspaceMutationSchema>;

export function mergeWorkspacePayload(
  base: PlayerWorkspacePayload,
  remote: PlayerWorkspacePayload,
  local: PlayerWorkspacePayload,
) {
  const remoteChanged = JSON.stringify(base) !== JSON.stringify(remote);
  const localChanged = JSON.stringify(base) !== JSON.stringify(local);
  if (remoteChanged && localChanged) return { conflict: true as const, payload: remote };
  return { conflict: false as const, payload: localChanged ? local : remote };
}
