"use client";

import { useEffect, useMemo, useState } from "react";
/** Carmen's file button SVG component */
import FileButton from "@/app/assets/FileButton"


type ValidationResult =
  | { ok: true }
  | { ok: false; errors: Array<{ path: string; message: string }> };

type Mission = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  contentJson: any;
  updatedAt: string;
};

export default function EditorPage() {
  const [missionId, setMissionId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);

  const [contentText, setContentText] = useState<string>(""); // JSON textarea
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);

  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
    alert("Button clicked!");
  };

  const contentJsonParsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(contentText) };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Invalid JSON" };
    }
  }, [contentText]);

  async function loadMission(id: string) {
    if (!id.trim()) {
      setStatus("Enter a mission id to load.");
      return;
    }

    setLoading(true);
    setStatus("Loading mission...");
    setLastValidation(null);

    try {
      const res = await fetch(`/api/missions/${id.trim()}`, { method: "GET" });
      const data = await res.json();

      if (!res.ok) {
        setStatus(`Load failed (${res.status}): ${data?.error ?? "Unknown error"}`);
        return;
      }

      const mission: Mission = data.mission;
      setMissionId(mission.id);
      setTitle(mission.title ?? "");
      setDescription(mission.description ?? "");
      setPublished(!!mission.published);
      setContentText(JSON.stringify(mission.contentJson ?? {}, null, 2));
      setLastValidation(data.contentJsonValidation ?? null);

      setStatus("Loaded.");
    } catch (err: any) {
      setStatus(`Load failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function createNewMission() {
    setLoading(true);
    setStatus("Creating new mission...");
    setLastValidation(null);

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled mission",
          description: "",
          published: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(`Create failed (${res.status}): ${data?.error ?? "Unknown error"}`);
        return;
      }

      const mission: Mission = data.mission;
      setMissionId(mission.id);
      setTitle(mission.title ?? "");
      setDescription(mission.description ?? "");
      setPublished(!!mission.published);
      setContentText(JSON.stringify(mission.contentJson ?? {}, null, 2));
      setStatus(`Created new mission: ${mission.id}`);
    } catch (err: any) {
      setStatus(`Create failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function validateOnServer() {
    if (!missionId.trim()) {
      setStatus("Load or create a mission first (needs an id).");
      return;
    }
    if (!contentJsonParsed.ok) {
      setStatus(`Local JSON error: ${contentJsonParsed.error}`);
      return;
    }

    setLoading(true);
    setStatus("Validating (via save endpoint dry-run)...");
    setLastValidation(null);

    try {
      // We validate by attempting a PATCH with only contentJson,
      // BUT we do NOT want to write yet. So we call GET to read validation instead.
      // (Server-side validation happens on PATCH; GET includes validation too.)
      // To validate the current textarea without saving: we'll POST to a lightweight endpoint later.
      // For now: we show local JSON parse validity + recommend "Save" as validation gate.
      setStatus("Local JSON parses OK. Server validation runs on Saveod. Use Save to confirm.");
      setLastValidation(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveMission() {
    if (!missionId.trim()) {
      setStatus("Load or create a mission first.");
      return;
    }
    if (!contentJsonParsed.ok) {
      setStatus(`Local JSON error: ${contentJsonParsed.error}`);
      return;
    }

    setLoading(true);
    setStatus("Saving...");
    setLastValidation(null);

    try {
      const res = await fetch(`/api/missions/${missionId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          published,
          contentJson: contentJsonParsed.value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If schema validation fails, API returns details
        const details = data?.details ? JSON.stringify(data.details, null, 2) : "";
        setStatus(`Save failed (${res.status}): ${data?.error ?? "Unknown error"}\n${details}`);
        return;
      }

      const mission: Mission = data.mission;
      setTitle(mission.title ?? "");
      setDescription(mission.description ?? "");
      setPublished(!!mission.published);
      setContentText(JSON.stringify(mission.contentJson ?? {}, null, 2));
      setStatus("Saved.");

      // Re-load to get validation block from GET (optional but helpful)
      await loadMission(mission.id);
    } catch (err: any) {
      setStatus(`Save failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  // Optional: auto-load if editor is opened with ?missionId=
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("missionId");
    if (q && q.trim()) {
      setMissionId(q.trim());
      loadMission(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (

    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Editor</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Thin slice editor: create, load, edit, validate-by-save, and publish missions.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          value={missionId}
          onChange={(e) => setMissionId(e.target.value)}
          placeholder="Mission ID (paste here)"
          style={{
            flex: 1,
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 8,
            fontFamily: "monospace",
          }}
        />

        <FileButton onClick={() => alert("Clicked!")}
        />

        <button
          onClick={() => loadMission(missionId)}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
        >
          Load
        </button>
        <button
          onClick={createNewMission}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
        >
          New
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Published</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span>{published ? "Yes (students can see it)" : "No (draft)"}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Mission Content JSON (contentJson)
        </label>
        <textarea
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          rows={16}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={validateOnServer}
            disabled={loading}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            Validate (local)
          </button>
          <button
            onClick={saveMission}
            disabled={loading}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc" }}
          >
            Save
          </button>
        </div>

        <div style={{ marginTop: 10, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {!contentJsonParsed.ok ? (
            <span style={{ color: "crimson" }}>Local JSON error: {contentJsonParsed.error}</span>
          ) : (
            <span style={{ color: "green" }}>Local JSON parses ✅</span>
          )}
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Status</div>
        <div style={{ whiteSpace: "pre-wrap" }}>{status || "—"}</div>

        {lastValidation && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>contentJsonValidation</div>
            <pre style={{ background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
              {JSON.stringify(lastValidation, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div> 
 );
}