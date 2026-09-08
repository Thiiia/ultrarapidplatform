export const AUTHORED_LESSON_VERSION = 3 as const;

export type AuthoredLessonTarget = {
  tokenIndex: number;
  sourceHitId?: string;
  positions?: string[];
  pads?: string[];
};

export type AuthoredLessonEquation = {
  id: string;
  state: string;
};

export type AuthoredLessonEncounter = {
  id: string;
  eventId: string;
  type: "hit" | "spin" | "drag";
  equationId?: string;
  startTick: number;
  endTick: number;
  hitBubbles?: unknown[];
  spinTargets?: AuthoredLessonTarget[];
  dragTargets?: AuthoredLessonTarget[];
};

export type AuthoredLessonPayload = {
  version: typeof AUTHORED_LESSON_VERSION;
  mode: "authored";
  songAssetId: string;
  activityKey: string;
  authorId: string;
  revision: string;
  stopAtSeconds?: number;
  equations: AuthoredLessonEquation[];
  encounters: AuthoredLessonEncounter[];
};

type AuthoredLessonDraft = Omit<AuthoredLessonPayload, "authorId" | "revision"> & {
  authorId?: string;
  revision?: string;
};

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Authored lesson ${label} is required`);
  }
  return value.trim();
}

function requireTick(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Authored lesson ${label} must be a non-negative integer`);
  }
  return Number(value);
}

function normalizeTarget(value: unknown, label: string): AuthoredLessonTarget {
  if (!value || typeof value !== "object") {
    throw new Error(`Authored lesson ${label} must be an object`);
  }
  const target = value as Record<string, unknown>;
  const tokenIndex = requireTick(target.tokenIndex, `${label}.tokenIndex`);
  const sourceHitId = target.sourceHitId == null
    ? undefined
    : requireString(target.sourceHitId, `${label}.sourceHitId`);
  const positions = target.positions == null
    ? undefined
    : Array.isArray(target.positions) && target.positions.every((position) => typeof position === "string")
      ? target.positions.map(String)
      : (() => { throw new Error(`Authored lesson ${label}.positions must be an array of strings`); })();
  const pads = target.pads == null
    ? undefined
    : Array.isArray(target.pads) && target.pads.every((pad) => typeof pad === "string")
      ? target.pads.map(String)
      : (() => { throw new Error(`Authored lesson ${label}.pads must be an array of strings`); })();
  return { tokenIndex, ...(sourceHitId ? { sourceHitId } : {}), ...(positions ? { positions } : {}), ...(pads ? { pads } : {}) };
}

export function parseAuthoredLessonDraft(value: unknown): AuthoredLessonDraft {
  if (!value || typeof value !== "object") {
    throw new Error("Authored lesson payload must be an object");
  }
  const payload = value as Record<string, unknown>;
  if (payload.version !== AUTHORED_LESSON_VERSION || payload.mode !== "authored") {
    throw new Error("Unsupported authored lesson payload version or mode");
  }
  const equations = Array.isArray(payload.equations) ? payload.equations.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Authored lesson equation ${index} is invalid`);
    const equation = value as Record<string, unknown>;
    return { id: requireString(equation.id, `equation[${index}].id`), state: requireString(equation.state, `equation[${index}].state`) };
  }) : (() => { throw new Error("Authored lesson equations must be an array"); })();
  const equationIds = new Set(equations.map((equation) => equation.id));
  if (equationIds.size !== equations.length) {
    throw new Error("Duplicate authored equation id");
  }
  const encounters = Array.isArray(payload.encounters) ? payload.encounters.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Authored lesson encounter ${index} is invalid`);
    const encounter = value as Record<string, unknown>;
    const type = requireString(encounter.type, `encounter[${index}].type`).toLowerCase();
    if (type !== "hit" && type !== "spin" && type !== "drag") throw new Error(`Unsupported authored lesson encounter type '${type}'`);
    const startTick = requireTick(encounter.startTick, `encounter[${index}].startTick`);
    const endTick = requireTick(encounter.endTick, `encounter[${index}].endTick`);
    const targetKey = type === "spin" ? "spinTargets" : type === "drag" ? "dragTargets" : null;
    const targets = targetKey == null
      ? undefined
      : Array.isArray(encounter[targetKey])
        ? (encounter[targetKey] as unknown[]).map((target, targetIndex) => normalizeTarget(target, `encounter[${index}].${targetKey}[${targetIndex}]`))
        : (() => { throw new Error(`Authored lesson encounter ${index}.${targetKey} must be an array`); })();
    return {
      id: requireString(encounter.id, `encounter[${index}].id`),
      eventId: requireString(encounter.eventId, `encounter[${index}].eventId`),
      type: type as AuthoredLessonEncounter["type"],
      ...(encounter.equationId == null ? {} : { equationId: requireString(encounter.equationId, `encounter[${index}].equationId`) }),
      startTick,
      endTick,
      ...(type === "hit" ? { hitBubbles: Array.isArray(encounter.hitBubbles) ? encounter.hitBubbles : [] } : {}),
      ...(type === "spin" ? { spinTargets: targets ?? [] } : {}),
      ...(type === "drag" ? { dragTargets: targets ?? [] } : {}),
    };
  }) : (() => { throw new Error("Authored lesson encounters must be an array"); })();
  const result: AuthoredLessonDraft = {
    version: AUTHORED_LESSON_VERSION,
    mode: "authored",
    songAssetId: requireString(payload.songAssetId, "songAssetId"),
    activityKey: requireString(payload.activityKey, "activityKey"),
    ...(payload.authorId == null ? {} : { authorId: requireString(payload.authorId, "authorId") }),
    ...(payload.revision == null ? {} : { revision: requireString(payload.revision, "revision") }),
    ...(payload.stopAtSeconds == null ? {} : { stopAtSeconds: Number(payload.stopAtSeconds) }),
    equations,
    encounters,
  };
  for (const encounter of result.encounters) {
    if (encounter.equationId && !equationIds.has(encounter.equationId)) {
      throw new Error(`Encounter '${encounter.id}' references missing equation '${encounter.equationId}'`);
    }
  }
  if (result.stopAtSeconds != null && (!Number.isFinite(result.stopAtSeconds) || result.stopAtSeconds < 0)) {
    throw new Error("Authored lesson stopAtSeconds must be a non-negative number");
  }
  const ids = new Set<string>();
  for (const encounter of result.encounters) {
    if (ids.has(encounter.id)) throw new Error(`Duplicate authored encounter id '${encounter.id}'`);
    ids.add(encounter.id);
  }
  if (result.equations.length === 0 && result.encounters.length === 0) {
    throw new Error("Authored lesson contains no equations or encounters");
  }
  return result;
}

export function stampAuthoredLessonIdentity(
  draft: AuthoredLessonDraft,
  identity: { songAssetId: string; activityKey: string; authorId: string; revision: string },
): AuthoredLessonPayload {
  if (draft.songAssetId !== identity.songAssetId) throw new Error("Authored lesson songAssetId does not match the saved song");
  if (draft.activityKey !== identity.activityKey) throw new Error("Authored lesson activityKey does not match the saved activity");
  if (draft.authorId && draft.authorId !== identity.authorId) throw new Error("Authored lesson authorId does not match the selected author");
  if (draft.revision && draft.revision !== identity.revision) throw new Error("Authored lesson revision does not match the saved revision");
  return { ...draft, authorId: identity.authorId, revision: identity.revision };
}
