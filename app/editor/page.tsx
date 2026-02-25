"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import FileButton from "@/app/assets/FileButton";

// IMPORTANT: dynamic import to prevent SSR crash on Vercel
const ReactGridLayout = dynamic(() => import("react-grid-layout"), {
  ssr: false,
});

// Required CSS imports
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

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
  const [mounted, setMounted] = useState(false);

  const [missionId, setMissionId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [contentText, setContentText] = useState<string>("");

  const [lastValidation, setLastValidation] =
    useState<ValidationResult | null>(null);

  // Ensure grid only renders after mount (prevents hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  const layout = [
    { i: "header", x: 0, y: 0, w: 12, h: 2, static: true },
    { i: "controls", x: 0, y: 2, w: 12, h: 3 },
    { i: "meta", x: 0, y: 5, w: 12, h: 4 },
    { i: "content", x: 0, y: 9, w: 12, h: 8 },
    { i: "status", x: 0, y: 17, w: 12, h: 4 },
  ];

  const contentJsonParsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(contentText) };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Invalid JSON" };
    }
  }, [contentText]);

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <ReactGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={30}
        width={1200}
      >
        {/* HEADER */}
        <div key="header">
          <h1 style={{ fontSize: 36, fontWeight: 700 }}>Editor</h1>
          <p style={{ color: "#555" }}>
            Grid-based mission editor (react-grid-layout)
          </p>
        </div>

        {/* LOAD / NEW */}
        <div key="controls">
          <div style={{ display: "flex", gap: 12 }}>
            <input
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              placeholder="Mission ID"
              style={{
                flex: 1,
                padding: 10,
                border: "1px solid #ccc",
                borderRadius: 8,
              }}
            />

            <FileButton onClick={() => alert("Clicked!")} />

            <button
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            >
              Load
            </button>

            <button
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            >
              New
            </button>
          </div>
        </div>

        {/* TITLE / PUBLISHED */}
        <div key="meta">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #ccc",
                borderRadius: 8,
              }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Published</label>
            <div>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
            </div>
          </div>
        </div>

        {/* CONTENT JSON */}
        <div key="content">
          <label style={{ fontWeight: 600 }}>
            Mission Content JSON
          </label>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            rows={12}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 13,
            }}
          />

          <div style={{ marginTop: 10 }}>
            {!contentJsonParsed.ok ? (
              <span style={{ color: "crimson" }}>
                JSON Error: {contentJsonParsed.error}
              </span>
            ) : (
              <span style={{ color: "green" }}>
                JSON parses ✅
              </span>
            )}
          </div>
        </div>

        {/* STATUS */}
        <div key="status">
          <div style={{ fontWeight: 700 }}>Status</div>
          <div style={{ whiteSpace: "pre-wrap" }}>
            {status || "—"}
          </div>

          {lastValidation && (
            <pre
              style={{
                background: "#fafafa",
                padding: 10,
                borderRadius: 8,
                overflow: "auto",
              }}
            >
              {JSON.stringify(lastValidation, null, 2)}
            </pre>
          )}
        </div>
      </ReactGridLayout>
    </div>
  );
}
