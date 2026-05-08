"use client"

import { EquationCircle, EquationTokenKind } from "./EventEquationEditor"

type EquationBlockPaletteProps = {
  onBlockDragStart?: (payload: { kind: EquationTokenKind; value: string }) => void
}

const BLOCKS: Array<{ kind: EquationTokenKind; value: string; label?: string }> = [
  { kind: "circle", value: "" },
  { kind: "circle", value: "X" },
  { kind: "circle", value: "Y" },
  { kind: "circle", value: "1" },
  { kind: "circle", value: "2" },
  { kind: "circle", value: "3" },
  { kind: "circle", value: "4" },
  { kind: "circle", value: "5" },
  { kind: "circle", value: "6" },
  { kind: "circle", value: "7" },
  { kind: "circle", value: "8" },
  { kind: "circle", value: "9" },
  { kind: "circle", value: "10" },
  { kind: "operator", value: "+" },
  { kind: "operator", value: "-" },
  { kind: "operator", value: "×" },
  { kind: "operator", value: "÷" },
  { kind: "equals", value: "=" },
]

function renderOperatorToken(value: string) {
  return (
    <div
      style={{
        minWidth: "56px",
        height: "56px",
        borderRadius: "14px",
        border: "1px solid #475569",
        background: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFFFFF",
        fontFamily: "var(--font-grandstander)",
        fontWeight: 700,
        fontSize: "28px",
      }}
    >
      {value}
    </div>
  )
}

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
          Drag circles and symbols into the equation.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        {BLOCKS.map((block, index) => {
          const payload = JSON.stringify({
            kind: block.kind,
            value: block.value,
          })

          return (
            <div
              key={`${block.kind}-${block.value}-${index}`}
              draggable
              onDragStart={(event) => {
                event.stopPropagation()
                event.dataTransfer.setData("application/x-equation-token", payload)
                event.dataTransfer.effectAllowed = "copy"
                onBlockDragStart?.({
                  kind: block.kind,
                  value: block.value,
                })
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "grab",
              }}
            >
              {block.kind === "circle" ? (
                <EquationCircle
                  value={block.value}
                  readOnly
                  size={56}
                />
              ) : (
                renderOperatorToken(block.value)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}