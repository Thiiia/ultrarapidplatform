import {
  PlayerWorkspacePayloadSchema,
  WorkspaceMutationSchema,
  type PlayerWorkspacePayload,
  type WorkspaceMutation,
} from "./player-workspace-contract";

export const MAX_WORKSPACE_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 5 * 60_000;

type WorkspaceRecord = {
  version?: number;
  payload?: PlayerWorkspacePayload | null;
};

export type WorkspaceSyncResult =
  | { kind: "ready"; mutation: WorkspaceMutation }
  | { kind: "success"; record: WorkspaceRecord | null }
  | { kind: "invalid-local"; code: "invalid_workspace_payload"; message: string; paths: string[] }
  | { kind: "permanent"; code: string; message: string; status: number; paths: string[] }
  | { kind: "retryable"; code: string; message: string; status?: number; retryAfterMs?: number; attempts?: number }
  | { kind: "conflict"; code: "workspace_version_conflict"; message: string; status: 409; current?: WorkspaceRecord | null };

export type WorkspaceMutationPreparation = Extract<WorkspaceSyncResult, { kind: "ready" | "invalid-local" }>;
export type WorkspaceResponseResult = Exclude<WorkspaceSyncResult, { kind: "ready" | "invalid-local" }>;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_json: "The workspace request was not valid JSON.",
  invalid_workspace_payload: "This private workspace change is not valid and was kept on this device.",
  lesson_revision_not_found: "This lesson revision is no longer available.",
  payload_too_large: "This private workspace change is too large to sync.",
  rate_limited: "Workspace sync is temporarily rate limited.",
  workspace_version_conflict: "This workspace changed elsewhere and needs a merge.",
  workspace_unavailable: "Your private workspace could not sync right now.",
};

function safeErrorCode(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(value) ? value : fallback;
}

function safePaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((path): path is string => typeof path === "string" && /^[a-zA-Z0-9_.[\]-]{1,80}$/.test(path)).slice(0, 12);
}

function safeRecord(value: unknown): WorkspaceRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { version?: unknown; payload?: unknown };
  const version = typeof candidate.version === "number" && Number.isInteger(candidate.version) && candidate.version >= 0
    ? candidate.version
    : undefined;
  if (candidate.payload === null || candidate.payload === undefined) return { version, payload: null };
  const payload = PlayerWorkspacePayloadSchema.safeParse(candidate.payload);
  return payload.success ? { version, payload: payload.data } : null;
}

async function readResponseBody(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function errorDetails(body: unknown, status: number) {
  const envelope = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  const error = envelope && typeof envelope === "object" ? envelope as { code?: unknown; paths?: unknown } : {};
  const fallback = status === 400 ? "invalid_json" : status === 413 ? "payload_too_large" : status === 429 ? "rate_limited" : status >= 500 ? "workspace_unavailable" : "workspace_request_rejected";
  const code = safeErrorCode(error.code, fallback);
  return { code, message: ERROR_MESSAGES[code] ?? (status >= 500 ? ERROR_MESSAGES.workspace_unavailable : "The private workspace request was rejected."), paths: safePaths(error.paths) };
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(seconds * 1_000));
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, timestamp - Date.now()));
  return undefined;
}

export function prepareWorkspaceMutation(input: unknown): WorkspaceMutationPreparation {
  const parsed = WorkspaceMutationSchema.safeParse(input);
  if (parsed.success) return { kind: "ready", mutation: parsed.data };
  const paths = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .filter((path) => path.length > 0)
    .filter((path, index, all) => all.indexOf(path) === index)
    .slice(0, 12);
  const credentialLike = parsed.error.issues.some((issue) => /credential-like|signed|token|secret/i.test(issue.message));
  return {
    kind: "invalid-local",
    code: "invalid_workspace_payload",
    message: credentialLike
      ? "Workspace draft contains credential-like data and was kept only on this device."
      : "Workspace draft is invalid and was kept only on this device.",
    paths,
  };
}

export async function classifyWorkspaceResponse(response: Response): Promise<WorkspaceResponseResult> {
  const body = await readResponseBody(response);
  if (response.ok) {
    const record = safeRecord(body);
    return record ? { kind: "success", record } : { kind: "retryable", code: "workspace_unavailable", message: ERROR_MESSAGES.workspace_unavailable, status: response.status };
  }

  const details = errorDetails(body, response.status);
  if (response.status === 409) {
    const current = body && typeof body === "object" ? safeRecord((body as { current?: unknown }).current) : null;
    return { kind: "conflict", code: "workspace_version_conflict", message: ERROR_MESSAGES.workspace_version_conflict, status: 409, current };
  }
  if (response.status === 429 || response.status >= 500) {
    return { kind: "retryable", code: details.code, message: details.message, status: response.status, retryAfterMs: retryAfterMs(response) };
  }
  return { kind: "permanent", code: details.code, message: details.message, status: response.status, paths: details.paths };
}

export function classifyWorkspaceError(): Extract<WorkspaceSyncResult, { kind: "retryable" }> {
  return { kind: "retryable", code: "workspace_unavailable", message: ERROR_MESSAGES.workspace_unavailable };
}

export function workspaceRetryDelay(attempt: number, retryAfter?: number) {
  if (retryAfter !== undefined) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAfter));
  return Math.min(4_000, 500 * 2 ** Math.max(0, attempt));
}
