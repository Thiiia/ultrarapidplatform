export const PLAYER_LESSON_WORKSPACE_VERSION = 1;
export const PLAYER_LESSON_WORKSPACE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const PLAYER_LESSON_WORKSPACE_MAX_BYTES = 48_000;

export type PlayerLessonEntryIntent = "play" | "personalize";

export type LessonSourceIdentity = {
  songAssetId: string;
  activityKey: string;
  authorId: string;
  revision: string;
};

export function resolveLessonWorkspaceSource(input: {
  songAssetId: string | null | undefined;
  activityKey: string | null | undefined;
  lastSavedAuthorId: string | null | undefined;
  selectedAuthorId: string | null | undefined;
  selectedAuthorName: string | null | undefined;
  revision: string | null | undefined;
}): LessonSourceIdentity | null {
  if (!input.songAssetId || !input.activityKey || !input.revision) return null;
  return {
    songAssetId: input.songAssetId,
    activityKey: input.activityKey,
    authorId: input.lastSavedAuthorId ?? input.selectedAuthorId ?? input.selectedAuthorName ?? "dev",
    revision: input.revision,
  };
}

export type PlayerLessonWorkspaceDraft = {
  version: typeof PLAYER_LESSON_WORKSPACE_VERSION;
  source: LessonSourceIdentity;
  timelineEvents: unknown[];
  equationEdits: unknown[];
  hiddenSourceEquationIds?: string[];
  updatedAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const credentialLikeKeySuffix = /(?:url|token|credential|secret|signature|useragent|ipaddress)$/i;

function assertSource(source: LessonSourceIdentity) {
  for (const value of Object.values(source)) {
    if (!value || /https?:\/\//i.test(value) || /x-amz-|token=|sig(nature)?=/i.test(value)) {
      throw new Error("Lesson workspace source identity contains credential-like data");
    }
  }
}

function containsCredentialLikeValue(value: unknown): boolean {
  if (typeof value === "string") {
    return /https?:\/\//i.test(value) || /x-amz-|token=|sig(nature)?=|access[_-]?token|secret/i.test(value);
  }
  if (Array.isArray(value)) return value.some(containsCredentialLikeValue);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) =>
      credentialLikeKeySuffix.test(key) || containsCredentialLikeValue(nested),
    );
  }
  return false;
}

export function playerLessonWorkspaceKey(source: LessonSourceIdentity): string {
  assertSource(source);
  return ["ultrarapid", "player-lesson-workspace", source.songAssetId, source.activityKey, source.authorId, source.revision]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export function readPlayerLessonWorkspaceDraft(
  storage: StorageLike,
  source: LessonSourceIdentity,
  now = Date.now(),
): PlayerLessonWorkspaceDraft | null {
  const key = playerLessonWorkspaceKey(source);
  const raw = storage.getItem(key);
  if (!raw) return null;
  if (new TextEncoder().encode(raw).byteLength > PLAYER_LESSON_WORKSPACE_MAX_BYTES) {
    storage.removeItem(key);
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PlayerLessonWorkspaceDraft;
    if (parsed.version !== PLAYER_LESSON_WORKSPACE_VERSION || !Number.isSafeInteger(parsed.updatedAt) || parsed.updatedAt < now - PLAYER_LESSON_WORKSPACE_MAX_AGE_MS) {
      storage.removeItem(key);
      return null;
    }
    if (JSON.stringify(parsed.source) !== JSON.stringify(source) || !Array.isArray(parsed.timelineEvents) || !Array.isArray(parsed.equationEdits) || containsCredentialLikeValue(parsed)) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writePlayerLessonWorkspaceDraft(storage: StorageLike, draft: PlayerLessonWorkspaceDraft): void {
  assertSource(draft.source);
  const encoded = JSON.stringify(draft);
  if (draft.version !== PLAYER_LESSON_WORKSPACE_VERSION || !Number.isSafeInteger(draft.updatedAt) || new TextEncoder().encode(encoded).byteLength > PLAYER_LESSON_WORKSPACE_MAX_BYTES || containsCredentialLikeValue(draft)) {
    throw new Error("Lesson workspace draft contains unsupported or credential-like data");
  }
  storage.setItem(playerLessonWorkspaceKey(draft.source), JSON.stringify(draft));
}

export function deletePlayerLessonWorkspaceDraft(storage: StorageLike, source: LessonSourceIdentity): void {
  storage.removeItem(playerLessonWorkspaceKey(source));
}
