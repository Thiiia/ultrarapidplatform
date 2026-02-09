import { z } from "zod";

// Preferred version going forward:
export const MISSION_CONTENT_VERSION = "1.0" as const;

/**
 * Accept older seed data too:
 * - version: 1  (old)
 * - version: "1.0" (new)
 */
const VersionSchema = z.union([z.literal(MISSION_CONTENT_VERSION), z.literal(1)]);

/**
 * Common block fields
 */
const BaseBlockSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
});

/**
 * v1 blocks
 *
 * Note: we accept both "text" and legacy "dialogue" as the same shape for now.
 */
const TextLikeBlockSchema = BaseBlockSchema.extend({
  type: z.union([z.literal("text"), z.literal("dialogue")]),
  text: z.string().min(1),
});

const UnityLevelBlockSchema = BaseBlockSchema.extend({
  type: z.literal("unity_level"),
  levelId: z.string().min(1),
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

const CheckpointBlockSchema = BaseBlockSchema.extend({
  type: z.literal("checkpoint"),
  key: z.string().min(1),
  label: z.string().optional(),
});

export const MissionBlockSchema = z.discriminatedUnion("type", [
  TextLikeBlockSchema,
  UnityLevelBlockSchema,
  CheckpointBlockSchema,
]);

export const MissionContentSchema = z.object({
  version: VersionSchema,
  meta: z
    .object({
      estimatedMinutes: z.number().int().positive().max(600).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  blocks: z.array(MissionBlockSchema),
});

export type MissionContent = z.infer<typeof MissionContentSchema>;

export function validateMissionContent(input: unknown) {
  const parsed = MissionContentSchema.safeParse(input);

  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }

  return {
    ok: false as const,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

// New missions we create will use the preferred format
export const DEFAULT_MISSION_CONTENT: MissionContent = {
  version: MISSION_CONTENT_VERSION,
  blocks: [
    { id: "b1", type: "text", text: "Welcome mission" },
    { id: "b2", type: "unity_level", levelId: "level_1" },
  ],
};