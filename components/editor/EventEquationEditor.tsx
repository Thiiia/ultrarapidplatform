"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { EquationCircle } from "./EquationCircle"
import type { EditorEventMode } from "./EventTypePalette"

export type EquationValue = {
  leftA: string
  operatorA: "+" | "-" | "×" | "÷"
  leftB: string
  equals: "="
  right: string
}

export type EquationSlot = "leftA" | "leftB" | "right"

export type EventVisualBinding = {
  mode: EditorEventMode
  hitAnchorSlot: EquationSlot | null
}

type EventEquationEditorProps = {
  value: EquationValue
  onChange: (value: EquationValue) => void
  eventVisual: EventVisualBinding
  onEventVisualChange: (value: EventVisualBinding) => void
}

const OPERATOR_OPTIONS: Array<EquationValue["operatorA"]> = ["+", "-", "×", "÷"]

function inferHitModeFromDrop(
  relativeX: number,
  relativeY: number
): EditorEventMode {
  if (Math.abs(relativeX) < 10) {
    return "hit_vertical"
  }

  if (relativeX < 0) {
    return "hit_diagonal_left"
  }

  return "hit_diagonal_right"
}

function getHitEllipseOffsets(mode: EditorEventMode, circleSize: number) {
  const verticalY = circleSize * 0.78
  const diagonalX = circleSize * 0.72
  const diagonalY = circleSize * 0.62

  switch (mode) {
    case "hit_vertical":
      return [
        { x: 0, y: -verticalY },
        { x: 0, y: verticalY },
      ]
    case "hit_diagonal_left":
      return [
        { x: -diagonalX, y: -diagonalY },
        { x: diagonalX, y: diagonalY },
      ]
    case "hit_diagonal_right":
      return [
        { x: diagonalX, y: -diagonalY },
        { x: -diagonalX, y: diagonalY },
      ]
    default:
      return []
  }
}

export function EventEquationEditor({
  value,
  onChange,
  eventVisual,
  onEventVisualChange,
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

  const handleDropOnSlot = (
    slot: EquationSlot,
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const equationBlock =
      event.dataTransfer.getData("application/x-equation-block") ||
      event.dataTransfer.getData("text/plain")

    const hitEllipse = event.dataTransfer.getData("application/x-hit-ellipse")

    if (hitEllipse) {
      const rect = event.currentTarget.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const relativeX = event.clientX - centerX
      const relativeY = event.clientY - centerY

      // We care about the 3 "upper" placements.
      // If dropped low, we still infer left/right/vertical from x.
      const nextMode = inferHitModeFromDrop(relativeX, relativeY)

      onEventVisualChange({
        mode: nextMode,
        hitAnchorSlot: slot,
      })
      return
    }

    if (equationBlock) {
      update(slot, equationBlock)
    }
  }

  const renderHitEllipses = (slot: EquationSlot) => {
    const isHitMode =
      eventVisual.mode === "hit_vertical" ||
      eventVisual.mode === "hit_diagonal_left" ||
      eventVisual.mode === "hit_diagonal_right"

    if (!isHitMode || eventVisual.hitAnchorSlot !== slot) return null

    const markerSize = Math.round(circleSize * 0.62)
    const offsets = getHitEllipseOffsets(eventVisual.mode, circleSize)

    return offsets.map((offset, index) => (
      <Image
        key={`${slot}-${eventVisual.mode}-${index}`}
        src="/images/hit-ellipse.png"
        alt="Hit ellipse marker"
        width={markerSize}
        height={markerSize}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${markerSize}px`,
          height: `${markerSize}px`,
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    ))
  }

  const renderDroppableCircle = (
    slot: EquationSlot,
    currentValue: string,
    placeholder: string
  ) => {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => handleDropOnSlot(slot, event)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          outline: "2px dashed transparent",
          position: "relative",
          zIndex: 2,
          minWidth: `${circleSize}px`,
          minHeight: `${circleSize}px`,
        }}
      >
        {renderHitEllipses(slot)}

        <div style={{ position: "relative", zIndex: 3 }}>
          <EquationCircle
            value={currentValue}
            onChange={(next) => update(slot, next)}
            placeholder={placeholder}
            size={circleSize}
          />
        </div>
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
          Drag number blocks onto circles. Drag the ellipse marker onto a circle to set the hit layout.
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
            padding: "28px 20px 56px 20px",
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
              zIndex: 3,
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
            {eventVisual.mode === "drag" && (
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
              zIndex: 3,
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