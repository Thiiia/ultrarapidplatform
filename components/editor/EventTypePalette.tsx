"use client"

type EventTypePaletteProps = {
  currentType: "hit" | "drag" | "spin" | null
  onSelectType: (type: "hit" | "drag" | "spin") => void
}

const TYPES: Array<{
  key: "hit" | "drag" | "spin"
  label: string
  color: string
}> = [
  { key: "hit", label: "Hit", color: "#9333ea" },
  { key: "drag", label: "Drag", color: "#dc2626" },
  { key: "spin", label: "Spin", color: "#9ca3af" },
]

export function EventTypePalette({
  currentType,
  onSelectType,
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
          Change the current event type.
        </p>
      </div>

      {TYPES.map((type) => {
        const active = currentType === type.key

        return (
          <button
            key={type.key}
            type="button"
            onClick={() => onSelectType(type.key)}
            style={{
              borderRadius: "14px",
              border: active ? `2px solid ${type.color}` : "1px solid #475569",
              background: active ? "#0f172a" : "#111827",
              color: "#FFFFFF",
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "9999px",
                background: type.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{type.label}</span>
          </button>
        )
      })}
    </div>
  )
}