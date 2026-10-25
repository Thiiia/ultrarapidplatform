const ACTIVITY_KEYS = ["number-bonds", "early-algebra"] as const;
const RUNTIME_MECHANICS = ["hit", "catch", "spinout", "spin", "drag"] as const;
const AUTHORED_MECHANICS = ["hit", "spin", "drag"] as const;
const EXPECTED_MECHANICS = {
  "number-bonds": {
    runtime: ["hit", "catch", "spinout", "drag"],
    authored: ["hit"],
    authoredSequences: [{ sequenceVersion: 1, encounterMechanics: ["hit", "spin", "drag"] }],
  },
  "early-algebra": {
    runtime: ["hit", "spin", "drag"],
    authored: ["hit", "spin", "drag"],
    authoredSequences: [],
  },
} as const;

export type RuntimeCapabilityActivityKey = typeof ACTIVITY_KEYS[number];
export type RuntimeCapabilityMechanic = typeof RUNTIME_MECHANICS[number];
export type AuthoredRuntimeAdapterMechanic = typeof AUTHORED_MECHANICS[number];

export type RuntimeCapabilityAuthoredAdapter = Readonly<{
  authoredLessonProtocolVersion: 3;
  mechanics: readonly AuthoredRuntimeAdapterMechanic[];
  multiSourceHitPrerequisites?: boolean;
}>;

export type RuntimeCapabilityAuthoredSequenceAdapter = Readonly<{
  authoredLessonProtocolVersion: 3;
  sequenceVersion: 1;
  encounterMechanics: readonly AuthoredRuntimeAdapterMechanic[];
}>;

export type RuntimeCapabilityActivity = Readonly<{
  activityKey: RuntimeCapabilityActivityKey;
  runtimeMechanics: readonly RuntimeCapabilityMechanic[];
  authoredLessonAdapters: readonly RuntimeCapabilityAuthoredAdapter[];
  authoredSequenceAdapters: readonly RuntimeCapabilityAuthoredSequenceAdapter[];
}>;

/** Dedicated mission capability; it is not an authored lesson activity. */
export type RuntimeCapabilityMissionAdapter = Readonly<{
  missionId: "perimeter-secure-boundary";
  contentSchemaVersion: 1;
  completionVersion: 4;
  geometryModel: "closed-rectilinear-fixed-point-v1";
  fixedPointScale: 1000;
  inputAdapters: readonly ["direct-edge-selection"];
  requiredResultFacts: readonly [
    "accepted-edge-ids",
    "submitted-total",
    "linear-unit",
    "assistance-provenance",
  ];
  featureFlags: readonly ["fresh-independent-check", "assistance-provenance"];
}>;

export type RuntimeCapabilityManifest = Readonly<{
  manifestVersion: 1 | 2;
  protocolVersions: Readonly<{
    runtimeProtocolVersion: 1;
    receiptVersion: 1;
    contractVersion: 1;
    completionVersions: readonly [2, 3] | readonly [2, 3, 4];
    authoredLessonProtocolVersion: 3;
    calibrationProtocolVersion: 1;
    publicDemoAdapterVersion: 1;
  }>;
  activities: readonly RuntimeCapabilityActivity[];
  /** Present only in manifest v2. Does not enable a launch or result writer. */
  missionAdapters?: readonly RuntimeCapabilityMissionAdapter[];
}>;

const MANIFEST_KEYS = ["manifestVersion", "protocolVersions", "activities"] as const;
const MANIFEST_V2_KEYS = [...MANIFEST_KEYS, "missionAdapters"] as const;
const PROTOCOL_KEYS = [
  "runtimeProtocolVersion",
  "receiptVersion",
  "contractVersion",
  "completionVersions",
  "authoredLessonProtocolVersion",
  "calibrationProtocolVersion",
  "publicDemoAdapterVersion",
] as const;
const ACTIVITY_KEYS_IN_DOCUMENT = ["activityKey", "runtimeMechanics", "authoredLessonAdapters", "authoredSequenceAdapters"] as const;
const ADAPTER_KEYS = ["authoredLessonProtocolVersion", "mechanics"] as const;
const MULTI_SOURCE_ADAPTER_KEYS = [...ADAPTER_KEYS, "multiSourceHitPrerequisites"] as const;
const SEQUENCE_ADAPTER_KEYS = ["authoredLessonProtocolVersion", "sequenceVersion", "encounterMechanics"] as const;
const MISSION_ADAPTER_KEYS = [
  "missionId",
  "contentSchemaVersion",
  "completionVersion",
  "geometryModel",
  "fixedPointScale",
  "inputAdapters",
  "requiredResultFacts",
  "featureFlags",
] as const;
const PERIMETER_INPUT_ADAPTERS = ["direct-edge-selection"] as const;
const PERIMETER_REQUIRED_RESULT_FACTS = [
  "accepted-edge-ids",
  "submitted-total",
  "linear-unit",
  "assistance-provenance",
] as const;
const PERIMETER_FEATURE_FLAGS = ["fresh-independent-check", "assistance-provenance"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unsupported shape.`);
  }
}

function parseStringArray<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  label: string,
): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedValues.includes(item as T)) {
      throw new Error(`${label} contains an unsupported value.`);
    }
    if (result.includes(item as T)) {
      throw new Error(`${label} contains a duplicate value.`);
    }
    result.push(item as T);
  }
  return result;
}

function matchesExpected(values: readonly string[], expected: readonly string[]): boolean {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function parseMissionAdapters(value: unknown): RuntimeCapabilityMissionAdapter[] {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("Runtime capability manifest v2 must declare its single supported Perimeter mission adapter.");
  }
  const adapter = value[0];
  if (!isRecord(adapter)) throw new Error("Perimeter mission adapter must be an object.");
  assertExactKeys(adapter, MISSION_ADAPTER_KEYS, "Perimeter mission adapter");
  if (
    adapter.missionId !== "perimeter-secure-boundary" ||
    adapter.contentSchemaVersion !== 1 ||
    adapter.completionVersion !== 4 ||
    adapter.geometryModel !== "closed-rectilinear-fixed-point-v1" ||
    adapter.fixedPointScale !== 1000
  ) {
    throw new Error("Perimeter mission adapter identity or domain contract is unsupported.");
  }

  const inputAdapters = parseStringArray(adapter.inputAdapters, PERIMETER_INPUT_ADAPTERS, "Perimeter input adapters");
  const requiredResultFacts = parseStringArray(adapter.requiredResultFacts, PERIMETER_REQUIRED_RESULT_FACTS, "Perimeter result facts");
  const featureFlags = parseStringArray(adapter.featureFlags, PERIMETER_FEATURE_FLAGS, "Perimeter feature flags");
  if (!matchesExpected(inputAdapters, PERIMETER_INPUT_ADAPTERS)) {
    throw new Error("Perimeter mission adapter advertises an unsupported input adapter.");
  }
  if (!matchesExpected(requiredResultFacts, PERIMETER_REQUIRED_RESULT_FACTS)) {
    throw new Error("Perimeter mission adapter omits or misstates required result facts.");
  }
  if (!matchesExpected(featureFlags, PERIMETER_FEATURE_FLAGS)) {
    throw new Error("Perimeter mission adapter omits or misstates required feature flags.");
  }

  return [{
    missionId: "perimeter-secure-boundary",
    contentSchemaVersion: 1,
    completionVersion: 4,
    geometryModel: "closed-rectilinear-fixed-point-v1",
    fixedPointScale: 1000,
    inputAdapters: ["direct-edge-selection"],
    requiredResultFacts: ["accepted-edge-ids", "submitted-total", "linear-unit", "assistance-provenance"],
    featureFlags: ["fresh-independent-check", "assistance-provenance"],
  }];
}

/**
 * Parse Unity build metadata for inspection and artifact comparison only.
 * This parser is deliberately separate from lesson publication and authoring
 * readiness; parsing a build does not grant an activity or mechanic to authors.
 */
export function parseRuntimeCapabilityManifestJson(json: string): RuntimeCapabilityManifest {
  if (typeof json !== "string") throw new Error("Runtime capability manifest JSON must be a string.");
  return parseRuntimeCapabilityManifest(JSON.parse(json) as unknown);
}

export function parseRuntimeCapabilityManifest(value: unknown): RuntimeCapabilityManifest {
  if (!isRecord(value)) throw new Error("Runtime capability manifest must be an object.");
  const manifestVersion = value.manifestVersion;
  if (manifestVersion !== 1 && manifestVersion !== 2) throw new Error("Unsupported runtime capability manifest version.");
  assertExactKeys(value, manifestVersion === 1 ? MANIFEST_KEYS : MANIFEST_V2_KEYS, "Runtime capability manifest");

  const protocolVersions = value.protocolVersions;
  if (!isRecord(protocolVersions)) throw new Error("Runtime capability protocolVersions must be an object.");
  assertExactKeys(protocolVersions, PROTOCOL_KEYS, "Runtime capability protocolVersions");
  if (
    protocolVersions.runtimeProtocolVersion !== 1 ||
    protocolVersions.receiptVersion !== 1 ||
    protocolVersions.contractVersion !== 1 ||
    protocolVersions.authoredLessonProtocolVersion !== 3 ||
    protocolVersions.calibrationProtocolVersion !== 1 ||
    protocolVersions.publicDemoAdapterVersion !== 1 ||
    !Array.isArray(protocolVersions.completionVersions) ||
    protocolVersions.completionVersions.length !== (manifestVersion === 1 ? 2 : 3) ||
    protocolVersions.completionVersions[0] !== 2 ||
    protocolVersions.completionVersions[1] !== 3 ||
    (manifestVersion === 2 && protocolVersions.completionVersions[2] !== 4)
  ) {
    throw new Error("Runtime capability manifest protocol axes do not match Runtime Protocol v1.");
  }

  if (!Array.isArray(value.activities) || value.activities.length !== ACTIVITY_KEYS.length) {
    throw new Error("Runtime capability manifest must advertise exactly the implemented activities.");
  }
  const seen = new Set<string>();
  const activities = value.activities.map((activity, index): RuntimeCapabilityActivity => {
    if (!isRecord(activity)) throw new Error(`Runtime capability activity ${index} must be an object.`);
    assertExactKeys(activity, ACTIVITY_KEYS_IN_DOCUMENT, `Runtime capability activity ${index}`);
    if (typeof activity.activityKey !== "string" || !ACTIVITY_KEYS.includes(activity.activityKey as RuntimeCapabilityActivityKey)) {
      throw new Error(`Runtime capability activity ${index} uses an unsupported activity key.`);
    }
    const activityKey = activity.activityKey as RuntimeCapabilityActivityKey;
    if (seen.has(activityKey)) throw new Error(`Runtime capability activity '${activityKey}' is duplicated.`);
    seen.add(activityKey);

    const runtimeMechanics = parseStringArray(activity.runtimeMechanics, RUNTIME_MECHANICS, "runtimeMechanics");
    if (!matchesExpected(runtimeMechanics, EXPECTED_MECHANICS[activityKey].runtime)) {
      throw new Error(`Runtime capability activity '${activityKey}' runtime mechanics do not match the implemented runtime.`);
    }

    if (!Array.isArray(activity.authoredLessonAdapters) || activity.authoredLessonAdapters.length !== 1) {
      throw new Error(`Runtime capability activity '${activityKey}' must declare its single supported authored lesson adapter.`);
    }
    const authoredLessonAdapters = activity.authoredLessonAdapters.map((adapter, adapterIndex): RuntimeCapabilityAuthoredAdapter => {
      if (!isRecord(adapter)) throw new Error(`Authored lesson adapter ${adapterIndex} must be an object.`);
      assertExactKeys(
        adapter,
        Object.prototype.hasOwnProperty.call(adapter, "multiSourceHitPrerequisites") ? MULTI_SOURCE_ADAPTER_KEYS : ADAPTER_KEYS,
        `Authored lesson adapter ${adapterIndex}`,
      );
      if (adapter.authoredLessonProtocolVersion !== 3) {
        throw new Error(`Authored lesson adapter ${adapterIndex} uses an unsupported lesson protocol.`);
      }
      const mechanics = parseStringArray(adapter.mechanics, AUTHORED_MECHANICS, "authored lesson mechanics");
      if (!matchesExpected(mechanics, EXPECTED_MECHANICS[activityKey].authored)) {
        throw new Error(`Runtime capability activity '${activityKey}' authored mechanics do not match the implemented adapter.`);
      }
      if (adapter.multiSourceHitPrerequisites !== undefined && typeof adapter.multiSourceHitPrerequisites !== "boolean") {
        throw new Error(`Authored lesson adapter ${adapterIndex} multiSourceHitPrerequisites must be a boolean.`);
      }
      if (adapter.multiSourceHitPrerequisites === true && activityKey !== "early-algebra") {
        throw new Error("Multi-source Hit prerequisites are supported only for Early Algebra.");
      }
      return {
        authoredLessonProtocolVersion: 3,
        mechanics,
        ...(adapter.multiSourceHitPrerequisites === undefined ? {} : { multiSourceHitPrerequisites: adapter.multiSourceHitPrerequisites }),
      };
    });

    const expectedSequenceAdapters = EXPECTED_MECHANICS[activityKey].authoredSequences;
    if (!Array.isArray(activity.authoredSequenceAdapters) || activity.authoredSequenceAdapters.length > expectedSequenceAdapters.length) {
      throw new Error(`Runtime capability activity '${activityKey}' declares unsupported authored sequence adapters.`);
    }
    const authoredSequenceAdapters = activity.authoredSequenceAdapters.map((adapter, adapterIndex): RuntimeCapabilityAuthoredSequenceAdapter => {
      if (!isRecord(adapter)) throw new Error(`Authored sequence adapter ${adapterIndex} must be an object.`);
      assertExactKeys(adapter, SEQUENCE_ADAPTER_KEYS, `Authored sequence adapter ${adapterIndex}`);
      const expectedSequenceAdapter = expectedSequenceAdapters.find((expected) => expected.sequenceVersion === adapter.sequenceVersion);
      if (adapter.authoredLessonProtocolVersion !== 3 || !expectedSequenceAdapter) {
        throw new Error(`Authored sequence adapter ${adapterIndex} uses an unsupported lesson or sequence protocol.`);
      }
      const encounterMechanics = parseStringArray(adapter.encounterMechanics, AUTHORED_MECHANICS, "authored sequence encounter mechanics");
      if (!matchesExpected(encounterMechanics, expectedSequenceAdapter.encounterMechanics)) {
        throw new Error(`Runtime capability activity '${activityKey}' authored sequence mechanics do not match the implemented adapter.`);
      }
      return {
        authoredLessonProtocolVersion: 3,
        sequenceVersion: 1,
        encounterMechanics,
      };
    });

    return {
      activityKey,
      runtimeMechanics,
      authoredLessonAdapters,
      authoredSequenceAdapters,
    };
  });

  if (ACTIVITY_KEYS.some((key) => !seen.has(key))) {
    throw new Error("Runtime capability manifest omits an implemented activity.");
  }

  const missionAdapters = manifestVersion === 2 ? parseMissionAdapters(value.missionAdapters) : undefined;

  return {
    manifestVersion,
    protocolVersions: {
      runtimeProtocolVersion: 1,
      receiptVersion: 1,
      contractVersion: 1,
      completionVersions: manifestVersion === 1 ? [2, 3] as const : [2, 3, 4] as const,
      authoredLessonProtocolVersion: 3,
      calibrationProtocolVersion: 1,
      publicDemoAdapterVersion: 1,
    },
    activities,
    ...(missionAdapters === undefined ? {} : { missionAdapters }),
  };
}
