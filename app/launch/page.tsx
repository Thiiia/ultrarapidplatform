"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MissionListItem = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  updatedAt: string;
};

type MissionDetail = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  updatedAt: string;
  contentJson: unknown;
};

type MissionListResponse = {
  missions?: MissionListItem[];
};

type MissionDetailResponse = {
  mission?: MissionDetail;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function LaunchPage() {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const initialMissionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("missionId");
  }, []);

  useEffect(() => {
    async function loadList() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/missions", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load missions (${res.status})`);
        const data = (await res.json()) as MissionListResponse;
        setMissions(data.missions ?? []);
      } catch (error: unknown) {
        setError(getErrorMessage(error, "Unknown error"));
      } finally {
        setLoading(false);
      }
    }

    loadList();
  }, []);

  const loadMission = useCallback(async (id: string) => {
    try {
      setSelectedId(id);
      setSelectedMission(null);
      setDetailLoading(true);

      const res = await fetch(`/api/missions/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load mission (${res.status}): ${text}`);
      }
      const data = (await res.json()) as MissionDetailResponse;
      setSelectedMission(data.mission ?? null);
    } catch (error: unknown) {
      setSelectedMission(null);
      alert(getErrorMessage(error, "Failed to load mission"));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Auto-load if missionId exists in URL
  useEffect(() => {
    if (!initialMissionId) return;
    loadMission(initialMissionId);
  }, [initialMissionId, loadMission]);

  return (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.2 }}>Launch</h1>
      <p style={{ marginTop: 6, opacity: 0.85 }}>
        Select a mission to load its JSON (Unity embed comes next).
      </p>

      {loading ? <p style={{ marginTop: 12 }}>Loading missions…</p> : null}
      {error ? (
        <p style={{ marginTop: 12, color: "crimson" }}>
          Error: {error}
          <br />
          (Are you logged in as student/teacher?)
        </p>
      ) : null}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {missions.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              background: "white",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{m.title}</div>
              {m.description ? (
                <div style={{ marginTop: 6, opacity: 0.8 }}>{m.description}</div>
              ) : null}
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
                Mission ID: <code>{m.id}</code>
              </div>
            </div>

            <div style={{ textAlign: "right", minWidth: 190 }}>
              <button
                type="button"
                onClick={() => loadMission(m.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Load JSON
              </button>

              {selectedId === m.id && detailLoading ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                  Loading…
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>Selected Mission JSON</h2>

        {!selectedMission ? (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            Click “Load JSON” on a mission, or open <code>/launch?missionId=...</code>
          </div>
        ) : (
          <pre
            style={{
              marginTop: 10,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #e6e6e6",
              overflowX: "auto",
              fontSize: 12,
              lineHeight: 1.4,
              background: "#fafafa",
            }}
          >
            {JSON.stringify(selectedMission.contentJson, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
