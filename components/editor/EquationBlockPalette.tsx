"use client"

import { EquationCircle } from "./EquationCircle"

type EquationBlockPaletteProps = {
  onBlockDragStart?: (value: string) => void
}

const BLOCKS = [
  { label: "", dragValue: "__EMPTY__" },
  { label: "X", dragValue: "X" },
  { label: "Y", dragValue: "Y" },
  { label: "1", dragValue: "1" },
  { label: "2", dragValue: "2" },
  { label: "3", dragValue: "3" },
  { label: "4", dragValue: "4" },
  { label: "5", dragValue: "5" },
  { label: "6", dragValue: "6" },
  { label: "7", dragValue: "7" },
  { label: "8", dragValue: "8" },
  { label: "9", dragValue: "9" },
  { label: "10", dragValue: "10" },
]

export function EquationBlockPalette({
  onBlockDragStart,
}: EquationBlockPaletteProps) {
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
          Blocks
        </h3>
        <p
          style={{
            marginTop: "6px",
            marginBottom: 0,
            fontSize: "13px",
            color: "#cbd5e1",
          }}
        >
          Drag circles onto the equation to replace values.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        {BLOCKS.map((block, index) => (
          <div
            key={`${block.dragValue}-${index}`}
            draggable
            onDragStart={(event) => {
              event.stopPropagation()
              event.dataTransfer.setData(
                "application/x-equation-block",
                block.dragValue
              )
              event.dataTransfer.effectAllowed = "copy"
              onBlockDragStart?.(block.dragValue)
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
            }}
          >
            <EquationCircle
              value={block.label}
              readOnly
              size={56}
            />
          </div>
        ))}
      </div>
    </div>
  )
}