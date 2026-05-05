"use client"

import { EquationCircle } from "./EquationCircle"

type EquationBlockPaletteProps = {
  onBlockDragStart?: (value: string) => void
}

const BLOCKS = ["X", "Y", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]

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
        {BLOCKS.map((block) => (
          <div
            key={block}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-equation-block", block)
              event.dataTransfer.effectAllowed = "copy"
              onBlockDragStart?.(block)
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
            }}
          >
            <EquationCircle
              value={block}
              readOnly
              size={56}
            />
          </div>
        ))}
      </div>
    </div>
  )
}