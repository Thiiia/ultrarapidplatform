"use client"

import Image from "next/image"
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
  eventType?: "hit" | "drag" | "spin" | null
}

const OPERATOR_OPTIONS: Array<EquationValue["operatorA"]> = ["+", "-", "×", "÷"]

export function EventEquationEditor({
  value,
  onChange,
  eventType = null,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [circleSize, setCircleSize] = useState(56)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const width = element.clientWidth
      const next = Math.max(52, Math.min(width * 0.06, 72))
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
    () => Math.max(24, Math.min(circleSize * 0.72, 36)),
    [circleSize]
  )

  const equalsFontSize = useMemo(
    () => Math.max(26, Math.min(circleSize * 0.82, 40)),
    [circleSize]
  )

  const update = <K extends keyof EquationValue>(key: K, nextValue: EquationValue[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  const handleDropOnSlot = (slot: "leftA" | "leftB" | "right", droppedValue: string) => {
    update(slot, droppedValue)
  }

  const renderDroppableCircle = (
    slot: "leftA" | "leftB" | "right",
    currentValue: string,
    placeholder: string
  ) => {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => {
          event.preventDefault()
          const droppedValue =
            event.dataTransfer.getData("application/x-equation-block") ||
            event.dataTransfer.getData("text/plain")

          if (droppedValue) {
            handleDropOnSlot(slot, droppedValue)
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          outline: "2px dashed transparent",
          position: "relative",
          zIndex: 2,
        }}
      >
        <EquationCircle
          value={currentValue}
          onChange={(next) => update(slot, next)}
          placeholder={placeholder}
          size={circleSize}
        />
      </div>
    )
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
        gap: "14px",
        color: "#FFFFFF",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          Event Equation
        </h3>
        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            fontSize: "15px",
            color: "#cbd5e1",
          }}
        >
          Drag blocks from the left or type directly into the circles.
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
            position: "relative",
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            padding: "18px 16px 48px 16px",
            minWidth: "max-content",
          }}
        >
          {renderDroppableCircle("leftA", value.leftA, "X")}

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
              color: "#FFFFFF",
              lineHeight: 1,
              padding: 0,
              margin: 0,
              minWidth: "24px",
              cursor: "pointer",
              position: "relative",
              zIndex: 2,
            }}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option} style={{ color: "#111827" }}>
                {option}
              </option>
            ))}
          </select>

          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            {eventType === "drag" && (
              <Image
                src="/images/drag-arc.png"
                alt="Drag arc"
                width={Math.round(circleSize * 4.25)}
                height={Math.round(circleSize * 2.45)}
                style={{
                  position: "absolute",
                  left: `${circleSize * 0.12}px`,
                  top: `${circleSize * 0.52}px`,
                  width: `${circleSize * 4.25}px`,
                  height: "auto",
                  zIndex: 0,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            )}

            {renderDroppableCircle("leftB", value.leftB, "2")}
          </div>

          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${equalsFontSize}px`,
              lineHeight: 1,
              display: "inline-block",
              color: "#FFFFFF",
              position: "relative",
              zIndex: 2,
            }}
          >
            {value.equals}
          </span>

          {renderDroppableCircle("right", value.right, "7")}
        </div>
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#cbd5e1",
        }}
      >
        Current equation:{" "}
        <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
          {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
        </span>
      </div>
    </div>
  )
}