"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EquationCircle } from "./EquationCircle"

export type EquationValue = {
  leftA: string
  operatorA: "+" | "-" | "×" | "÷"
  leftB: string
  equals: "="
  right: string
}

type EventEquationEditorProps = {
  value: EquationValue
  onChange: (value: EquationValue) => void
}

const OPERATOR_OPTIONS: Array<EquationValue["operatorA"]> = ["+", "-", "×", "÷"]

export function EventEquationEditor({
  value,
  onChange,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [circleSize, setCircleSize] = useState(34)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const width = element.clientWidth
      const next = Math.max(28, Math.min(width * 0.028, 36))
      setCircleSize(next)
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const operatorFontSize = useMemo(
    () => Math.max(16, Math.min(circleSize * 0.85, 24)),
    [circleSize]
  )

  const equalsFontSize = useMemo(
    () => Math.max(18, Math.min(circleSize * 0.95, 26)),
    [circleSize]
  )

  const update = <K extends keyof EquationValue>(key: K, nextValue: EquationValue[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "12px",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 600,
          }}
        >
          Event Equation
        </h3>
        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            fontSize: "16px",
            color: "#6b7280",
          }}
        >
          Edit the equation assigned to the current event.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "0 16px",
            minWidth: "max-content",
          }}
        >
          <EquationCircle
            value={value.leftA}
            onChange={(next) => update("leftA", next)}
            placeholder="x"
            size={circleSize}
          />

          <select
            value={value.operatorA}
            onChange={(e) => update("operatorA", e.target.value as EquationValue["operatorA"])}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              appearance: "none",
              textAlign: "center",
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${operatorFontSize}px`,
              lineHeight: 1,
              padding: 0,
              margin: 0,
              minWidth: "20px",
              cursor: "pointer",
            }}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <EquationCircle
            value={value.leftB}
            onChange={(next) => update("leftB", next)}
            placeholder="2"
            size={circleSize}
          />

          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${equalsFontSize}px`,
              lineHeight: 1,
              display: "inline-block",
            }}
          >
            {value.equals}
          </span>

          <EquationCircle
            value={value.right}
            onChange={(next) => update("right", next)}
            placeholder="7"
            size={circleSize}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#4b5563",
        }}
      >
        Current equation:{" "}
        <span style={{ fontWeight: 500 }}>
          {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
        </span>
      </div>
    </div>
  )
}