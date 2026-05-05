"use client"

import Image from "next/image"

export type EditorEventMode =
  | "hit_vertical"
  | "hit_diagonal_left"
  | "hit_diagonal_right"
  | "drag"
  | "spin"

type EventTypePaletteProps = {
  currentMode: EditorEventMode | null
  onSelectMode: (mode: EditorEventMode) => void
}

export function EventTypePalette({
  currentMode,
  onSelectMode,
}: EventTypePaletteProps) {
  return (
    <div
      style={{
        width: "220px",
        minWidth: "220px",
        borderRadius: "20px",
        border: "1px solid #334155",
        background: "#1f2937",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          Event Type
        </h3>
        <p
          style={{
            marginTop: "6px",
            marginBottom: 0,
            fontSize: "13px",
            color: "#cbd5e1",
          }}
        >
          Drag only the ellipse onto a circle for hit layouts. Use buttons for drag/spin.
        </p>
      </div>

      <div
        style={{
          borderRadius: "16px",
          border: "1px solid #475569",
          background: "#111827",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "center",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        <div
          draggable
          onDragStart={(event) => {
            event.stopPropagation()
            event.dataTransfer.setData("application/x-hit-ellipse", "hit-ellipse")
            event.dataTransfer.effectAllowed = "copy"
          }}
          onDragEnd={(event) => {
            event.stopPropagation()
          }}
          style={{
            width: "56px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "grab",
            borderRadius: "12px",
          }}
        >
          <Image
            src="/images/hit-ellipse.png"
            alt="Hit ellipse"
            width={48}
            height={48}
            style={{
              width: "48px",
              height: "48px",
              objectFit: "contain",
              display: "block",
              userSelect: "none",
            }}
            draggable={false}
          />
        </div>

        <div style={{ fontWeight: 700, color: "#FFFFFF", fontSize: "14px" }}>
          Hit Ellipse
        </div>

        <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>
          Drop above a circle = Vertical hit
          <br />
          Drop up-left = Diagonal Left
          <br />
          Drop up-right = Diagonal Right
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelectMode("drag")}
        style={{
          borderRadius: "14px",
          border: currentMode === "drag" ? "2px solid #dc2626" : "1px solid #475569",
          background: currentMode === "drag" ? "#0f172a" : "#111827",
          color: "#FFFFFF",
          padding: "14px 16px",
          cursor: "pointer",
          textAlign: "left",
          fontWeight: 600,
        }}
      >
        Drag
      </button>

      <button
        type="button"
        onClick={() => onSelectMode("spin")}
        style={{
          borderRadius: "14px",
          border: currentMode === "spin" ? "2px solid #9ca3af" : "1px solid #475569",
          background: currentMode === "spin" ? "#0f172a" : "#111827",
          color: "#FFFFFF",
          padding: "14px 16px",
          cursor: "pointer",
          textAlign: "left",
          fontWeight: 600,
        }}
      >
        Spin
      </button>
    </div>
  )
}