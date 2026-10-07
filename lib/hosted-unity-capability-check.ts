import { createHash } from "node:crypto";
import { parseAuthoredLessonDraft } from "./authored-lesson";
import {
  parseRuntimeCapabilityManifestJson,
  type RuntimeCapabilityManifest,
} from "./runtime-capability-manifest";
import type { SongLaunchReceipt } from "./song-launch-package";

const MAX_METADATA_BYTES = 64 * 1024;
const MAX_SIDECAR_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export type HostedUnityCapabilityErrorCode =
  | "RUNTIME_CAPABILITY_UNAVAILABLE"
  | "RUNTIME_CAPABILITY_UNSUPPORTED"
  | "PUBLISHED_LESSON_IDENTITY_MISMATCH";

export class HostedUnityCapabilityError extends Error {
  constructor(
    readonly code: HostedUnityCapabilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HostedUnityCapabilityError";
  }
}

export type EffectiveLessonRuntimeCapability = Readonly<{
  activityKey: string;
  implemented: true;
  authoredLessonProtocolVersion: 3;
  sequenceVersion?: 1;
}>;

export function normalizeLf(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function runtimeMetadataUrl(gameUrl: string, filename: string) {
  let base: URL;
  try {
    base = new URL(gameUrl);
  } catch {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity runtime URL is invalid.",
    );
  }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity runtime URL must be a plain HTTPS base URL.",
    );
  }
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(filename, base);
}

async function readBoundedResponse(response: Response, maxBytes: number, label: string) {
  if (!response.ok) {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      `The hosted Unity ${label} could not be loaded.`,
    );
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      `The hosted Unity ${label} exceeds the supported size.`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new HostedUnityCapabilityError(
          "RUNTIME_CAPABILITY_UNAVAILABLE",
          `The hosted Unity ${label} exceeds the supported size.`,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function sha256Lf(value: string) {
  return createHash("sha256").update(normalizeLf(value), "utf8").digest("hex");
}

export async function loadHostedUnityRuntimeCapabilities(
  gameUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ manifest: RuntimeCapabilityManifest; digest: string }> {
  const buildInfoUrl = runtimeMetadataUrl(gameUrl, "build-info.json");
  const manifestUrl = runtimeMetadataUrl(gameUrl, "runtime-capabilities.json");
  let buildInfoText: string;
  let manifestText: string;
  try {
    const [buildInfoResponse, manifestResponse] = await Promise.all([
      fetcher(buildInfoUrl, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
      fetcher(manifestUrl, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
    ]);
    [buildInfoText, manifestText] = await Promise.all([
      readBoundedResponse(buildInfoResponse, MAX_METADATA_BYTES, "build identity"),
      readBoundedResponse(manifestResponse, MAX_METADATA_BYTES, "capability manifest"),
    ]);
  } catch (error) {
    if (error instanceof HostedUnityCapabilityError) throw error;
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity build identity or capability manifest could not be verified.",
    );
  }

  let buildInfo: unknown;
  try {
    buildInfo = JSON.parse(buildInfoText) as unknown;
  } catch {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity build identity is malformed.",
    );
  }
  if (!buildInfo || typeof buildInfo !== "object" || Array.isArray(buildInfo)) {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity build identity is malformed.",
    );
  }
  const expectedDigest = (buildInfo as Record<string, unknown>).runtimeCapabilitiesSha256Lf;
  const actualDigest = sha256Lf(manifestText);
  if (typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/i.test(expectedDigest) ||
      actualDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity capability manifest does not match its build identity.",
    );
  }

  try {
    return {
      manifest: parseRuntimeCapabilityManifestJson(manifestText),
      digest: actualDigest,
    };
  } catch {
    throw new HostedUnityCapabilityError(
      "RUNTIME_CAPABILITY_UNAVAILABLE",
      "The hosted Unity capability manifest is unsupported or malformed.",
    );
  }
}

function capabilityFailure(message: string): never {
  throw new HostedUnityCapabilityError("RUNTIME_CAPABILITY_UNSUPPORTED", message);
}

export function evaluateAuthoredLessonRuntimeCapability(
  manifest: RuntimeCapabilityManifest,
  rawLesson: unknown,
  expectedActivityKey: string,
  expectedIdentity?: Pick<SongLaunchReceipt, "songAssetId" | "authorId" | "revision" | "rhythmDifficultyKey">,
): EffectiveLessonRuntimeCapability {
  let lesson;
  try {
    lesson = parseAuthoredLessonDraft(rawLesson, {
      requirePublishedIdentity: Boolean(expectedIdentity),
      activityKey: expectedActivityKey,
    });
  } catch {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The published lesson sidecar is malformed or does not match its receipt.",
    );
  }
  if (lesson.activityKey !== expectedActivityKey ||
      (expectedIdentity && (lesson.songAssetId !== expectedIdentity.songAssetId ||
        lesson.authorId !== expectedIdentity.authorId || lesson.revision !== expectedIdentity.revision ||
        (expectedActivityKey === "number-bonds" && expectedIdentity.rhythmDifficultyKey != null &&
          lesson.rhythmDifficultyKey != null && lesson.rhythmDifficultyKey !== expectedIdentity.rhythmDifficultyKey)))) {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The published lesson sidecar identity does not match its receipt.",
    );
  }

  const activity = manifest.activities.find((entry) => entry.activityKey === lesson.activityKey);
  if (!activity) return capabilityFailure(`The hosted Unity build does not implement '${lesson.activityKey}'.`);

  if (lesson.activityKey === "number-bonds" && lesson.numberBondSequenceVersion === 1) {
    const sequenceAdapter = activity.authoredSequenceAdapters.find((entry) =>
      entry.authoredLessonProtocolVersion === lesson.version && entry.sequenceVersion === 1,
    );
    if (!sequenceAdapter || !["hit", "spin", "drag"].every((mechanic) =>
      sequenceAdapter.encounterMechanics.includes(mechanic as "hit" | "spin" | "drag"),
    )) {
      return capabilityFailure("The hosted Unity build does not support Number Bonds sequence version 1.");
    }
    return {
      activityKey: lesson.activityKey,
      implemented: true,
      authoredLessonProtocolVersion: 3,
      sequenceVersion: 1,
    };
  }

  if (lesson.activityKey === "number-bonds" && lesson.encounters.some((encounter) => encounter.type !== "hit")) {
    return capabilityFailure("Number Bonds lessons with Spin or Drag encounters require sequence version 1.");
  }
  const requiredMechanics = new Set(lesson.encounters.map((encounter) => encounter.type));
  const lessonAdapter = activity.authoredLessonAdapters.find((entry) =>
    entry.authoredLessonProtocolVersion === lesson.version &&
    [...requiredMechanics].every((mechanic) => entry.mechanics.includes(mechanic)),
  );
  if (!lessonAdapter) {
    return capabilityFailure(`The hosted Unity build cannot play this '${lesson.activityKey}' authored lesson.`);
  }
  return {
    activityKey: lesson.activityKey,
    implemented: true,
    authoredLessonProtocolVersion: 3,
  };
}

export async function assertHostedUnitySupportsPublishedLesson(input: {
  gameUrl: string;
  sidecarUrl: string;
  expectedActivityKey: string;
  receipt: SongLaunchReceipt;
  fetcher?: typeof fetch;
}): Promise<EffectiveLessonRuntimeCapability> {
  const fetcher = input.fetcher ?? fetch;
  const expectedSidecarSha256 = input.receipt.hashes?.sidecarSha256;
  if (!expectedSidecarSha256 || !/^[a-f0-9]{64}$/i.test(expectedSidecarSha256)) {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The launch receipt is missing the published sidecar hash.",
    );
  }

  let sidecarText: string;
  try {
    const sidecarUrl = new URL(input.sidecarUrl);
    if (sidecarUrl.protocol !== "https:" || sidecarUrl.username || sidecarUrl.password) {
      throw new Error("invalid sidecar URL");
    }
    const response = await fetcher(sidecarUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    sidecarText = await readBoundedResponse(response, MAX_SIDECAR_BYTES, "published lesson sidecar");
  } catch (error) {
    if (error instanceof HostedUnityCapabilityError) throw error;
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The published lesson sidecar could not be loaded for identity verification.",
    );
  }
  if (createHash("sha256").update(sidecarText, "utf8").digest("hex").toLowerCase() !== expectedSidecarSha256.toLowerCase()) {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The published lesson sidecar does not match its receipt hash.",
    );
  }
  let rawLesson: unknown;
  try {
    rawLesson = JSON.parse(sidecarText) as unknown;
  } catch {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The published lesson sidecar is malformed.",
    );
  }

  const { manifest } = await loadHostedUnityRuntimeCapabilities(input.gameUrl, fetcher);
  if (input.receipt.activityKey !== input.expectedActivityKey) {
    throw new HostedUnityCapabilityError(
      "PUBLISHED_LESSON_IDENTITY_MISMATCH",
      "The launch receipt activity key does not match the selected activity.",
    );
  }
  return evaluateAuthoredLessonRuntimeCapability(
    manifest,
    rawLesson,
    input.expectedActivityKey,
    input.receipt,
  );
}
