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

function formatLabel(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (initial) => initial.toUpperCase());
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

export function UnityRuntimeDiagnosticsPanel() {
  const capabilities = useContext(RuntimeCapabilitiesContext);

  if (!capabilities || capabilities.status === "checking") {
    return <p role="status" aria-live="polite">Loading the hosted Unity runtime manifest…</p>;
  }

  if (capabilities.status === "unavailable") {
    return (
      <p role="alert">
        The hosted Unity runtime manifest is unavailable. Check the deployed build and try again.
      </p>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 16px", color: "#D1D5DB", lineHeight: 1.6 }}>
        Authored actions reported by the current hosted Unity build.
      </p>
      <ul style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", listStyle: "none", margin: 0, padding: 0 }}>
        {capabilities.activities.map((activity) => (
          <li
            key={activity.activityKey}
            style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 12, padding: 16 }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
              {formatLabel(activity.activityKey)}
            </h2>
            <p style={{ margin: 0, color: "#D1D5DB", lineHeight: 1.5 }}>
              {activity.mechanics.length > 0
                ? activity.mechanics.map(formatLabel).join(" · ")
                : "No authored actions reported"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
