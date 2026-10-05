import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertHostedUnitySupportsPublishedLesson,
  evaluateAuthoredLessonRuntimeCapability,
  loadHostedUnityRuntimeCapabilities,
} from "../lib/hosted-unity-capability-check";
import { parseRuntimeCapabilityManifestJson } from "../lib/runtime-capability-manifest";
import type { SongLaunchReceipt } from "../lib/song-launch-package";

const manifestPath = fileURLToPath(new URL(
  "../contracts/runtime-capabilities/v1/runtime-capabilities.json",
  import.meta.url,
));
const lessonPath = fileURLToPath(new URL(
  "../contracts/number-bonds/sequence-v1/fixtures.json",
  import.meta.url,
));
const manifestText = readFileSync(manifestPath, "utf8");
const manifest = parseRuntimeCapabilityManifestJson(manifestText);
const fixture = JSON.parse(readFileSync(lessonPath, "utf8")) as {
  validLesson: Record<string, unknown> & {
    songAssetId: string;
    activityKey: string;
    authorId: string;
    revision: string;
  };
};

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("authored Number Bonds sequence v1 compatibility comes from the hosted build manifest", () => {
  const result = evaluateAuthoredLessonRuntimeCapability(
    manifest,
    fixture.validLesson,
    "number-bonds",
    fixture.validLesson,
  );

  assert.deepEqual(result, {
    activityKey: "number-bonds",
    implemented: true,
    authoredLessonProtocolVersion: 3,
    sequenceVersion: 1,
  });
});

test("legacy Number Bonds Hit-only content uses the authored lesson adapter without requiring sequence v1", () => {
  const activities = JSON.parse(manifestText).activities as Array<Record<string, unknown>>;
  const hitOnlyManifest = parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...JSON.parse(manifestText),
    activities: [
      { ...activities[0], authoredSequenceAdapters: [] },
      activities[1],
    ],
  }));
  const legacyLesson = { ...fixture.validLesson };
  delete legacyLesson.numberBondSequenceVersion;
  delete legacyLesson.numberBondGems;
  legacyLesson.encounters = (fixture.validLesson.encounters as Array<{ type: string }>).filter(
    (encounter) => encounter.type === "hit",
  );

  const result = evaluateAuthoredLessonRuntimeCapability(
    hitOnlyManifest,
    legacyLesson,
    "number-bonds",
    fixture.validLesson,
  );

  assert.equal(result.implemented, true);
  assert.equal("sequenceVersion" in result, false);
});

test("sequence-v1 lessons fail when the hosted build only declares the legacy Hit adapter", () => {
  const activities = JSON.parse(manifestText).activities as Array<Record<string, unknown>>;
  const hitOnlyManifest = parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...JSON.parse(manifestText),
    activities: [
      { ...activities[0], authoredSequenceAdapters: [] },
      activities[1],
    ],
  }));

  assert.throws(
    () => evaluateAuthoredLessonRuntimeCapability(hitOnlyManifest, fixture.validLesson, "number-bonds"),
    /does not support Number Bonds sequence version 1/,
  );
});

test("hosted build identity digest must match the downloaded runtime manifest", async () => {
  const normalizedManifest = manifestText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const expectedDigest = digest(normalizedManifest);
  const fetcher = async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.endsWith("/build-info.json")) {
      return new Response(JSON.stringify({ runtimeCapabilitiesSha256Lf: expectedDigest }), { status: 200 });
    }
    return new Response(manifestText, { status: 200 });
  };

  const result = await loadHostedUnityRuntimeCapabilities("https://game.example/", fetcher as typeof fetch);
  assert.equal(result.digest, expectedDigest);
  assert.deepEqual(result.manifest.activities[0].authoredSequenceAdapters[0], {
    authoredLessonProtocolVersion: 3,
    sequenceVersion: 1,
    encounterMechanics: ["hit", "spin", "drag"],
  });
});

test("hosted metadata response limits stop and cancel oversized streamed bodies", async () => {
  let cancelled = false;
  const fetcher = async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.endsWith("/build-info.json")) {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(64 * 1024 + 1));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, { status: 200 });
    }
    return new Response(manifestText, { status: 200 });
  };

  await assert.rejects(
    () => loadHostedUnityRuntimeCapabilities("https://game.example/", fetcher as typeof fetch),
    /build identity exceeds the supported size/,
  );
  assert.equal(cancelled, true);
});

test("receipt runtimeCapabilities cannot substitute for a missing hosted sequence adapter", () => {
  const activities = JSON.parse(manifestText).activities as Array<Record<string, unknown>>;
  const hitOnlyManifest = parseRuntimeCapabilityManifestJson(JSON.stringify({
    ...JSON.parse(manifestText),
    activities: [
      { ...activities[0], authoredSequenceAdapters: [] },
      activities[1],
    ],
  }));
  const receipt = {
    ...fixture.validLesson,
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
  } as unknown as Pick<SongLaunchReceipt, "songAssetId" | "authorId" | "revision">;

  assert.throws(
    () => evaluateAuthoredLessonRuntimeCapability(hitOnlyManifest, fixture.validLesson, "number-bonds", receipt),
    /does not support Number Bonds sequence version 1/,
  );
});

test("the hosted gate verifies the published sidecar hash before returning effective support", async () => {
  const sidecarText = JSON.stringify(fixture.validLesson);
  const manifestDigest = digest(manifestText.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  const receipt = {
    receiptVersion: 1,
    contractVersion: 1,
    songAssetId: fixture.validLesson.songAssetId,
    activityKey: fixture.validLesson.activityKey,
    authorId: fixture.validLesson.authorId,
    revision: fixture.validLesson.revision,
    source: "authored",
    runtimeCapabilities: ["authored-lesson-v3", "launch-receipt-v1"],
    chart: { bucket: "Charts", path: "chart" },
    sidecar: { bucket: "SidecarJsons", path: "sidecar" },
    audio: { bucket: "Songs", path: "audio" },
    counts: { encounters: 15, equations: 1, targets: 15 },
    hashes: {
      chartSha256: "a".repeat(64),
      sidecarSha256: digest(sidecarText),
      audioSha256: "c".repeat(64),
    },
  } as SongLaunchReceipt;
  const fetcher = async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url === "https://storage.example/sidecar") return new Response(sidecarText, { status: 200 });
    if (url.endsWith("/build-info.json")) {
      return new Response(JSON.stringify({ runtimeCapabilitiesSha256Lf: manifestDigest }), { status: 200 });
    }
    return new Response(manifestText, { status: 200 });
  };

  const result = await assertHostedUnitySupportsPublishedLesson({
    gameUrl: "https://game.example/",
    sidecarUrl: "https://storage.example/sidecar",
    expectedActivityKey: "number-bonds",
    receipt,
    fetcher: fetcher as typeof fetch,
  });

  assert.equal(result.implemented, true);
  assert.equal(result.sequenceVersion, 1);
});

test("changed published sidecar bytes fail receipt validation before a build check", async () => {
  const sidecarText = JSON.stringify(fixture.validLesson);
  const changedText = `${sidecarText} `;
  const receipt = {
    hashes: { sidecarSha256: digest(sidecarText) },
  } as unknown as SongLaunchReceipt;
  const requested: string[] = [];
  const fetcher = async (input: URL | RequestInfo) => {
    requested.push(String(input));
    return new Response(changedText, { status: 200 });
  };

  await assert.rejects(
    () => assertHostedUnitySupportsPublishedLesson({
      gameUrl: "https://game.example/",
      sidecarUrl: "https://storage.example/sidecar",
      expectedActivityKey: "number-bonds",
      receipt,
      fetcher: fetcher as typeof fetch,
    }),
    /does not match its receipt hash/,
  );
  assert.deepEqual(requested, ["https://storage.example/sidecar"]);
});
