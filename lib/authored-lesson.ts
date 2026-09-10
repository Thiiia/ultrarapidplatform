export const AUTHORED_LESSON_VERSION = 3 as const;

export const AUTHORED_HIT_PADS = [
  "topLeft",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottomRight",
] as const;

type AuthoredHitPad = (typeof AUTHORED_HIT_PADS)[number];

export type AuthoredLessonTarget = {
  tokenIndex: number;
  sourceHitId?: string;
  positions?: string[];
  pads?: string[];
};

export type AuthoredLessonHitBubble = {
  tokenIndex: number;
  positions?: AuthoredHitPad[];
  pads?: AuthoredHitPad[];
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
  hitBubbles?: AuthoredLessonHitBubble[];
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

export type AuthoredLessonDraft = Omit<AuthoredLessonPayload, "authorId" | "revision"> & {
  authorId?: string;
  revision?: string;
};

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Authored lesson ${label} is required`);
  }
  return value;
}

function requireTick(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Authored lesson ${label} must be a non-negative integer`);
  }
  return Number(value);
}

function requireHitPad(value: unknown, label: string): AuthoredHitPad {
  if (typeof value !== "string" || !AUTHORED_HIT_PADS.includes(value as AuthoredHitPad)) {
    throw new Error(`Authored lesson ${label} must be one of ${AUTHORED_HIT_PADS.join(", ")}`);
  }
  return value as AuthoredHitPad;
}

function normalizePadList(value: unknown, label: string): AuthoredHitPad[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Authored lesson ${label} must be an array`);
  }
  return value.map((pad, index) => requireHitPad(pad, `${label}[${index}]`));
}

function normalizeHitBubble(value: unknown, label: string): AuthoredLessonHitBubble {
  if (!value || typeof value !== "object") {
    throw new Error(`Authored lesson ${label} must be an object`);
  }
  const bubble = value as Record<string, unknown>;
  const tokenIndex = requireTick(bubble.tokenIndex, `${label}.tokenIndex`);
  const positions = normalizePadList(bubble.positions, `${label}.positions`);
  const pads = normalizePadList(bubble.pads, `${label}.pads`);
  return { tokenIndex, ...(positions ? { positions } : {}), ...(pads ? { pads } : {}) };
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
  const positions = normalizePadList(target.positions, `${label}.positions`);
  const pads = normalizePadList(target.pads, `${label}.pads`);
  return { tokenIndex, ...(sourceHitId ? { sourceHitId } : {}), ...(positions ? { positions } : {}), ...(pads ? { pads } : {}) };
}

export function tokenizeAuthoredEquationState(state: string) {
  const tokens: string[] = [];
  let index = 0;
  while (index < state.length) {
    if (/\s/.test(state[index])) {
      index += 1;
      continue;
    }
    if (/[+\-=*/^()×÷−]/.test(state[index])) {
      tokens.push(state[index]);
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (index < state.length && !/\s/.test(state[index]) && !/[+\-=*/^()×÷−]/.test(state[index])) {
      index += 1;
    }
    tokens.push(state.slice(start, index));
  }
  return tokens;
}

function equationTokenCount(state: string) {
  return tokenizeAuthoredEquationState(state).length;
}

export function parseAuthoredLessonDraft(
  value: unknown,
  options: { requirePublishedIdentity?: boolean } = {},
): AuthoredLessonDraft {
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
  const equationById = new Map(equations.map((equation) => [equation.id, equation]));
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
    if (startTick > endTick) {
      throw new Error(`Authored lesson encounter[${index}] startTick must not exceed endTick`);
    }
    if ((type === "spin" || type === "drag") && endTick <= startTick) {
      throw new Error(`Authored lesson ${type} '${requireString(encounter.id, `encounter[${index}].id`)}' requires a positive duration`);
    }
    const targetKey = type === "spin" ? "spinTargets" : type === "drag" ? "dragTargets" : null;
    const targets = targetKey == null
      ? []
      : Array.isArray(encounter[targetKey])
        ? (encounter[targetKey] as unknown[]).map((target, targetIndex) => normalizeTarget(target, `encounter[${index}].${targetKey}[${targetIndex}]`))
        : (() => { throw new Error(`Authored lesson encounter ${index}.${targetKey} must be an array`); })();
    if (targetKey && targets.length === 0) {
      throw new Error(`Authored lesson encounter ${index}.${targetKey} requires at least one target`);
    }
    const hitBubbles = type !== "hit"
      ? []
      : encounter.hitBubbles == null
        ? (() => { throw new Error(`Authored lesson encounter ${index}.hitBubbles must be an array`); })()
        : Array.isArray(encounter.hitBubbles)
          ? (encounter.hitBubbles as unknown[]).map((bubble, bubbleIndex) => normalizeHitBubble(bubble, `encounter[${index}].hitBubbles[${bubbleIndex}]`))
          : (() => { throw new Error(`Authored lesson encounter ${index}.hitBubbles must be an array`); })();
    if (type === "hit" && hitBubbles.length === 0) {
      throw new Error(`Authored lesson encounter ${index}.hitBubbles requires at least one target`);
    }
    return {
      id: requireString(encounter.id, `encounter[${index}].id`),
      eventId: requireString(encounter.eventId, `encounter[${index}].eventId`),
      type: type as AuthoredLessonEncounter["type"],
      ...(encounter.equationId == null ? {} : { equationId: requireString(encounter.equationId, `encounter[${index}].equationId`) }),
      startTick,
      endTick,
      ...(type === "hit" ? { hitBubbles } : {}),
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
    ...(payload.stopAtSeconds == null
      ? {}
      : typeof payload.stopAtSeconds === "number" && Number.isFinite(payload.stopAtSeconds) && payload.stopAtSeconds >= 0
        ? { stopAtSeconds: payload.stopAtSeconds }
        : (() => { throw new Error("Authored lesson stopAtSeconds must be a non-negative number"); })()),
    equations,
    encounters,
  };
  if (options.requirePublishedIdentity && (!result.authorId || !result.revision)) {
    throw new Error("Authored lesson published launch requires authorId and revision");
  }
  for (const encounter of result.encounters) {
    if (encounter.equationId && !equationIds.has(encounter.equationId)) {
      throw new Error(`Encounter '${encounter.id}' references missing equation '${encounter.equationId}'`);
    }
  const equation = encounter.equationId ? equationById.get(encounter.equationId) : undefined;
    if (!encounter.equationId) {
      throw new Error(`Encounter '${encounter.id}' requires equationId`);
    }
    const tokenCount = equation ? equationTokenCount(equation.state) : null;
    const targets = encounter.type === "hit"
      ? encounter.hitBubbles ?? []
      : encounter.type === "spin"
        ? encounter.spinTargets ?? []
        : encounter.dragTargets ?? [];
    if (tokenCount !== null && targets.some((target) => target.tokenIndex >= tokenCount)) {
      throw new Error(`Encounter '${encounter.id}' has a target tokenIndex outside its equation`);
    }
  }
  const hits = new Map(result.encounters.filter((encounter) => encounter.type === "hit").map((encounter) => [encounter.id, encounter]));
  for (const encounter of result.encounters) {
    for (const target of encounter.type === "drag" ? encounter.dragTargets ?? [] : []) {
      if (!target.sourceHitId) continue;
      const source = hits.get(target.sourceHitId);
      if (!source) {
        throw new Error(`Encounter '${encounter.id}' sourceHitId '${target.sourceHitId}' references a missing hit`);
      }
      if (source.startTick > encounter.startTick) {
        throw new Error(`Encounter '${encounter.id}' sourceHitId '${target.sourceHitId}' starts after the drag`);
      }
    }
  }
  const ids = new Set<string>();
  for (const encounter of result.encounters) {
    if (ids.has(encounter.id)) throw new Error(`Duplicate authored encounter id '${encounter.id}'`);
    ids.add(encounter.id);
  }
  // Hit durations: hits are instantaneous (start must equal end).
  for (const encounter of result.encounters) {
    if (encounter.type === "hit" && encounter.startTick !== encounter.endTick) {
      throw new Error(`Authored lesson hit '${encounter.id}' must be instantaneous (startTick === endTick)`);
    }
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
  // draft.revision is the PREVIOUS revision (concurrency precondition, already
  // verified against storage state by the caller); identity.revision is the NEW
  // revision being published. They must differ on a second save, so do not
  // equate them here — just stamp the new revision as the output identity.
  return { ...draft, authorId: identity.authorId, revision: identity.revision };
}
