const ACTIVITY_KEYS = ["number-bonds", "early-algebra"] as const;
const RUNTIME_MECHANICS = ["hit", "catch", "spinout", "spin", "drag"] as const;
const AUTHORED_MECHANICS = ["hit", "spin", "drag"] as const;
const EXPECTED_MECHANICS = {
  "number-bonds": {
    runtime: ["hit", "catch", "spinout", "drag"],
    authored: ["hit"],
  },
  "early-algebra": {
    runtime: ["hit", "spin", "drag"],
    authored: ["hit", "spin", "drag"],
  },
} as const;

export type RuntimeCapabilityActivityKey = typeof ACTIVITY_KEYS[number];
export type RuntimeCapabilityMechanic = typeof RUNTIME_MECHANICS[number];
export type AuthoredRuntimeAdapterMechanic = typeof AUTHORED_MECHANICS[number];

export type RuntimeCapabilityAuthoredAdapter = Readonly<{
  authoredLessonProtocolVersion: 3;
  mechanics: readonly AuthoredRuntimeAdapterMechanic[];
}>;

export type RuntimeCapabilityActivity = Readonly<{
  activityKey: RuntimeCapabilityActivityKey;
  runtimeMechanics: readonly RuntimeCapabilityMechanic[];
  authoredLessonAdapters: readonly RuntimeCapabilityAuthoredAdapter[];
}>;

export type RuntimeCapabilityManifest = Readonly<{
  manifestVersion: 1;
  protocolVersions: Readonly<{
    runtimeProtocolVersion: 1;
    receiptVersion: 1;
    contractVersion: 1;
    completionVersions: readonly [2, 3];
    authoredLessonProtocolVersion: 3;
    calibrationProtocolVersion: 1;
    publicDemoAdapterVersion: 1;
  }>;
  activities: readonly RuntimeCapabilityActivity[];
}>;

const MANIFEST_KEYS = ["manifestVersion", "protocolVersions", "activities"] as const;
const PROTOCOL_KEYS = [
  "runtimeProtocolVersion",
  "receiptVersion",
  "contractVersion",
  "completionVersions",
  "authoredLessonProtocolVersion",
  "calibrationProtocolVersion",
  "publicDemoAdapterVersion",
] as const;
const ACTIVITY_KEYS_IN_DOCUMENT = ["activityKey", "runtimeMechanics", "authoredLessonAdapters"] as const;
const ADAPTER_KEYS = ["authoredLessonProtocolVersion", "mechanics"] as const;

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
  assertExactKeys(value, MANIFEST_KEYS, "Runtime capability manifest");
  if (value.manifestVersion !== 1) throw new Error("Unsupported runtime capability manifest version.");

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
    protocolVersions.completionVersions.length !== 2 ||
    protocolVersions.completionVersions[0] !== 2 ||
    protocolVersions.completionVersions[1] !== 3
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
      assertExactKeys(adapter, ADAPTER_KEYS, `Authored lesson adapter ${adapterIndex}`);
      if (adapter.authoredLessonProtocolVersion !== 3) {
        throw new Error(`Authored lesson adapter ${adapterIndex} uses an unsupported lesson protocol.`);
      }
      const mechanics = parseStringArray(adapter.mechanics, AUTHORED_MECHANICS, "authored lesson mechanics");
      if (!matchesExpected(mechanics, EXPECTED_MECHANICS[activityKey].authored)) {
        throw new Error(`Runtime capability activity '${activityKey}' authored mechanics do not match the implemented adapter.`);
      }
      return {
        authoredLessonProtocolVersion: 3,
        mechanics,
      };
    });

    return {
      activityKey,
      runtimeMechanics,
      authoredLessonAdapters,
    };
  });

  if (ACTIVITY_KEYS.some((key) => !seen.has(key))) {
    throw new Error("Runtime capability manifest omits an implemented activity.");
  }

  return {
    manifestVersion: 1,
    protocolVersions: {
      runtimeProtocolVersion: 1,
      receiptVersion: 1,
      contractVersion: 1,
      completionVersions: [2, 3],
      authoredLessonProtocolVersion: 3,
      calibrationProtocolVersion: 1,
      publicDemoAdapterVersion: 1,
    },
    activities,
  };
}
