"use client";

import { useEffect, useState } from "react";
import {
  clearSongFlowDebugEntries,
  getSongFlowDebugEntries,
  songFlowDebugEventName,
  type SongFlowDebugEntry,
} from "@/lib/song-flow-debug";

type SongFlowDebuggerProps = {
  title?: string;
};

export default function SongFlowDebugger({
  title = "Song Flow Debugger",
}: SongFlowDebuggerProps) {
  const [entries, setEntries] = useState<SongFlowDebugEntry[]>(() =>
    getSongFlowDebugEntries(),
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setEntries(getSongFlowDebugEntries());
    };

    window.addEventListener(songFlowDebugEventName, handleUpdate);

    return () => {
      window.removeEventListener(songFlowDebugEventName, handleUpdate);
    };
  }, []);

  return (
    <aside
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: isOpen ? "min(440px, calc(100vw - 32px))" : 220,
        maxHeight: isOpen ? "70vh" : 56,
        background: "rgba(6, 11, 21, 0.96)",
        color: "#FFFFFF",
        border: "1px solid #CFFF04",
        borderRadius: 12,
        zIndex: 1000,
        boxShadow: "0 18px 48px rgba(0,0,0,0.38)",
        overflow: "hidden",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          background: "#111827",
          borderBottom: isOpen ? "1px solid rgba(255,255,255,0.12)" : "none",
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          style={{
            background: "transparent",
            color: "#FFFFFF",
            border: "none",
            padding: 0,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {title} ({entries.length})
        </button>

        <button
          type="button"
          onClick={() => {
            clearSongFlowDebugEntries();
            setEntries([]);
          }}
          style={{
            background: "transparent",
            color: "#CFFF04",
            border: "none",
            padding: 0,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {isOpen ? (
        <div
          style={{
            maxHeight: "calc(70vh - 48px)",
            overflowY: "auto",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          {entries.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 12 }}>
              No song flow events recorded yet.
            </div>
          ) : (
            [...entries].reverse().map((entry) => (
              <section
                key={entry.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: 10,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>
                  {entry.timestamp}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#CFFF04" }}>
                  {entry.stage}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{entry.summary}</div>
                {typeof entry.payload !== "undefined" ? (
                  <pre
                    style={{
                      margin: "8px 0 0",
                      padding: 8,
                      borderRadius: 8,
                      background: "#030712",
                      color: "#D1D5DB",
                      fontSize: 11,
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                ) : null}
              </section>
            ))
          )}
        </div>
      ) : null}
    </aside>
  );
}