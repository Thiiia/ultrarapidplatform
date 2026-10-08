"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type UnityActivitySupport = {
  activityKey: string;
  mechanics: string[];
};

type UnityCapabilitiesResponse = {
  activities: UnityActivitySupport[];
};

type CapabilitiesState =
  | { status: "checking" }
  | { status: "ready"; activities: UnityActivitySupport[] }
  | { status: "unavailable" };

const RuntimeCapabilitiesContext = createContext<CapabilitiesState | null>(null);

function isUnityActivitySupport(value: unknown): value is UnityActivitySupport {
  if (!value || typeof value !== "object") {
    return false;
  }
  const activity = value as { activityKey?: unknown; mechanics?: unknown };
  return typeof activity.activityKey === "string" &&
    Array.isArray(activity.mechanics) &&
    activity.mechanics.every((mechanic: unknown) => typeof mechanic === "string");
}

function isUnityCapabilitiesResponse(value: unknown): value is UnityCapabilitiesResponse {
  if (!value || typeof value !== "object") return false;
  const activities = (value as { activities?: unknown }).activities;
  return Array.isArray(activities) && activities.every(isUnityActivitySupport);
}

function formatMechanic(mechanic: string) {
  return mechanic.replace(/[-_]/g, " ").replace(/^./, (initial) => initial.toUpperCase());
}

async function loadCapabilities(signal?: AbortSignal): Promise<UnityActivitySupport[]> {
  const response = await fetch("/api/unity/capabilities", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Unity capabilities are unavailable.");

  const payload: unknown = await response.json();
  if (!isUnityCapabilitiesResponse(payload)) {
    throw new Error("Unity capabilities are malformed.");
  }

  return payload.activities;
}

export function UnityRuntimeCapabilitiesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [capabilities, setCapabilities] = useState<CapabilitiesState>({
    status: "checking",
  });

  useEffect(() => {
    const controller = new AbortController();
    setCapabilities({ status: "checking" });

    void loadCapabilities(controller.signal)
      .then((activities) => {
        if (!controller.signal.aborted) {
          setCapabilities({ status: "ready", activities });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCapabilities({ status: "unavailable" });
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <RuntimeCapabilitiesContext.Provider value={capabilities}>
      {children}
    </RuntimeCapabilitiesContext.Provider>
  );
}

export function UnityRuntimeSupport({ activityKey }: { activityKey: string }) {
  const sharedCapabilities = useContext(RuntimeCapabilitiesContext);
  const [localCapabilities, setLocalCapabilities] =
    useState<CapabilitiesState>({ status: "checking" });

  useEffect(() => {
    if (sharedCapabilities) return;

    const controller = new AbortController();
    setLocalCapabilities({ status: "checking" });
    void loadCapabilities(controller.signal)
      .then((activities) => {
        if (!controller.signal.aborted) {
          setLocalCapabilities({ status: "ready", activities });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLocalCapabilities({ status: "unavailable" });
        }
      });

    return () => controller.abort();
  }, [sharedCapabilities]);

  const capabilities = sharedCapabilities ?? localCapabilities;
  const activity =
    capabilities.status === "ready"
      ? capabilities.activities.find((entry) => entry.activityKey === activityKey)
      : undefined;
  const support =
    capabilities.status === "checking"
      ? { status: "checking" as const }
      : capabilities.status === "unavailable"
        ? { status: "unavailable" as const }
        : !activity || activity.mechanics.length === 0
          ? { status: "unsupported" as const }
          : { status: "ready" as const, mechanics: activity.mechanics };

  const state = support.status;
  const value =
    support.status === "checking"
      ? "Checking"
      : support.status === "ready"
        ? support.mechanics.map(formatMechanic).join(" · ")
        : support.status === "unsupported"
          ? "Not supported"
          : "Unavailable";

  return (
    <div
      className="experience-runtime-support"
      data-state={state}
      role="status"
      aria-live="polite"
      aria-busy={state === "checking"}
      aria-label={
        support.status === "ready"
          ? `Unity activity actions: ${support.mechanics.map(formatMechanic).join(", ")}`
          : support.status === "checking"
            ? "Checking Unity activity actions"
            : support.status === "unsupported"
              ? "This activity has no actions in the Unity runtime manifest"
              : "Unity activity actions are unavailable"
      }
      title="Actions reported by Unity's verified runtime manifest. The selected lesson is checked again when you launch it."
    >
      <span className="experience-runtime-support__label">UNITY</span>
      <span className="experience-runtime-support__value">{value}</span>
    </div>
  );
}
