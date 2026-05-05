"use client"

import Image from "next/image"
import { useMemo, useState } from "react"

type TokenType = "circle" | "operator"

type Token = {
  id: string
  label: string
  type: TokenType
}

const CIRCLE_IMAGE_SRC = "/images/equation-circle.png"

const PALETTE_TOKENS: Token[] = [
  { id: "x", label: "X", type: "circle" },
  { id: "y", label: "Y", type: "circle" },
  { id: "1", label: "1", type: "circle" },
  { id: "2", label: "2", type: "circle" },
  { id: "3", label: "3", type: "circle" },
  { id: "4", label: "4", type: "circle" },
  { id: "5", label: "5", type: "circle" },
  { id: "6", label: "6", type: "circle" },
  { id: "7", label: "7", type: "circle" },
  { id: "8", label: "8", type: "circle" },
  { id: "9", label: "9", type: "circle" },
  { id: "10", label: "10", type: "circle" },

  { id: "plus", label: "+", type: "operator" },
  { id: "minus", label: "-", type: "operator" },
  { id: "times", label: "×", type: "operator" },
  { id: "divide", label: "÷", type: "operator" },
  { id: "equals", label: "=", type: "operator" },
]

function getCircleFontSize(label: string) {
  if (label.length <= 1) return 98.05
  if (label.length === 2) return 78
  return 64
}

function EquationCircleBlock({ label, size = 120 }: { label: string; size?: number }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <Image
        src={CIRCLE_IMAGE_SRC}
        alt={label}
        fill
        className="object-contain pointer-events-none select-none"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="leading-none text-center select-none"
          style={{
            fontFamily: "var(--font-grandstander)",
            fontWeight: 700,
            fontSize: `${getCircleFontSize(label)}px`,
            color: "#FFFFFF",
            width: "78%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function OperatorBlock({ label }: { label: string }) {
  return (
    <div className="h-[72px] min-w-[72px] rounded-2xl border bg-white px-5 flex items-center justify-center shadow-sm">
      <span
        style={{
          fontFamily: "var(--font-grandstander)",
          fontWeight: 700,
          fontSize: "40px",
          color: "#111827",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function TokenView({ token }: { token: Token }) {
  if (token.type === "circle") {
    return <EquationCircleBlock label={token.label} />
  }

  return <OperatorBlock label={token.label} />
}

type DragPayload =
  | {
      source: "palette"
      token: Token
    }
  | {
      source: "equation"
      token: Token
      index: number
    }

export function EquationBuilderDnD() {
  const [equationTokens, setEquationTokens] = useState<Token[]>([])
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const equationText = useMemo(
    () => equationTokens.map((token) => token.label).join(" "),
    [equationTokens]
  )

  const cloneToken = (token: Token) => ({
    ...token,
    id: `${token.id}-${crypto.randomUUID()}`,
  })

  const handlePaletteDragStart = (token: Token) => {
    setDragPayload({
      source: "palette",
      token,
    })
  }

  const handleEquationDragStart = (token: Token, index: number) => {
    setDragPayload({
      source: "equation",
      token,
      index,
    })
  }

  const handleDropAtIndex = (index: number) => {
    if (!dragPayload) return

    setEquationTokens((prev) => {
      if (dragPayload.source === "palette") {
        const next = [...prev]
        next.splice(index, 0, cloneToken(dragPayload.token))
        return next
      }

      const next = [...prev]
      const [moved] = next.splice(dragPayload.index, 1)

      const adjustedIndex =
        dragPayload.index < index ? index - 1 : index

      next.splice(adjustedIndex, 0, moved)
      return next
    })

    setDragPayload(null)
    setDropIndex(null)
  }

  const handleDropToEnd = () => {
    if (!dragPayload) return

    setEquationTokens((prev) => {
      if (dragPayload.source === "palette") {
        return [...prev, cloneToken(dragPayload.token)]
      }

      const next = [...prev]
      const [moved] = next.splice(dragPayload.index, 1)
      next.push(moved)
      return next
    })

    setDragPayload(null)
    setDropIndex(null)
  }

  const handleRemoveToken = (index: number) => {
    setEquationTokens((prev) => prev.filter((_, i) => i !== index))
  }

  const clearEquation = () => {
    setEquationTokens([])
    setDropIndex(null)
    setDragPayload(null)
  }

  return (
    <div className="rounded-2xl border p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Drag-and-Drop Equation Builder</h2>
        <p className="text-sm text-gray-500">
          Drag circle blocks and operators into the equation box to build an equation.
        </p>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Block Palette</h3>
          <div className="text-sm text-gray-500">
            Variables, numbers, and operators
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {PALETTE_TOKENS.map((token) => (
            <div
              key={token.id}
              draggable
              onDragStart={() => handlePaletteDragStart(token)}
              onDragEnd={() => {
                setDragPayload(null)
                setDropIndex(null)
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <TokenView token={token} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Equation Box</h3>

          <button
            type="button"
            onClick={clearEquation}
            className="rounded border px-3 py-2 text-sm"
          >
            Clear
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (equationTokens.length === 0) {
              setDropIndex(0)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDropToEnd()
          }}
          className="min-h-[180px] rounded-2xl border-2 border-dashed bg-black/5 p-4"
        >
          {equationTokens.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Drag blocks here to create an equation
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {equationTokens.map((token, index) => (
                <div
                  key={token.id}
                  className="flex items-center gap-4"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropIndex(index)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropAtIndex(index)
                  }}
                >
                  {dropIndex === index && (
                    <div className="w-2 h-24 rounded-full bg-blue-500" />
                  )}

                  <div
                    draggable
                    onDragStart={() => handleEquationDragStart(token, index)}
                    onDragEnd={() => {
                      setDragPayload(null)
                      setDropIndex(null)
                    }}
                    className="group relative cursor-grab active:cursor-grabbing"
                  >
                    <TokenView token={token} />

                    <button
                      type="button"
                      onClick={() => handleRemoveToken(index)}
                      className="absolute -top-2 -right-2 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full border bg-white text-sm shadow"
                      aria-label={`Remove ${token.label}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {dropIndex === equationTokens.length && (
                <div className="w-2 h-24 rounded-full bg-blue-500" />
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-black/5 p-4 text-sm text-gray-700">
          <span className="font-medium">Equation:</span>{" "}
          {equationText || "No equation created yet"}
        </div>
      </div>
    </div>
  )
}