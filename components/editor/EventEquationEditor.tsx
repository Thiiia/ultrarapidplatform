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
  dragStartSlot?: EquationSlot | null
  dragEndSlot?: EquationSlot | null
}

type EventEquationEditorProps = {
  value: EquationValue
  onChange: (value: EquationValue) => void
  eventVisual: EventVisualBinding
  onEventVisualChange: (value: EventVisualBinding) => void
}

const OPERATOR_OPTIONS: Array<EquationValue["operatorA"]> = ["+", "-", "×", "÷"]
const SLOT_ORDER: EquationSlot[] = ["leftA", "leftB", "right"]

function inferHitModeFromDrop(relativeX: number): EditorEventMode {
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

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function EventEquationEditor({
  value,
  onChange,
  eventVisual,
  onEventVisualChange,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const equationAreaRef = useRef<HTMLDivElement | null>(null)

  const leftARef = useRef<HTMLDivElement | null>(null)
  const leftBRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)

  const [circleSize, setCircleSize] = useState(56)
  const [slotCenters, setSlotCenters] = useState<Record<EquationSlot, { x: number; y: number }>>({
    leftA: { x: 0, y: 0 },
    leftB: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  })
  const [isDraggingArcEnd, setIsDraggingArcEnd] = useState(false)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)

  const gradientId = useMemo(
    () => `drag-gradient-${Math.random().toString(36).slice(2)}`,
    []
  )

  const slotRefs: Record<EquationSlot, React.RefObject<HTMLDivElement | null>> = {
    leftA: leftARef,
    leftB: leftBRef,
    right: rightRef,
  }

  const dragStartSlot = eventVisual.dragStartSlot ?? "leftB"
  const dragEndSlot = eventVisual.dragEndSlot ?? "right"

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

  useEffect(() => {
    const measureLayout = () => {
      const wrapper = equationAreaRef.current
      if (!wrapper) return

      const wrapperRect = wrapper.getBoundingClientRect()

      const getCenter = (node: HTMLDivElement | null) => {
        if (!node) {
          return { x: 0, y: 0 }
        }

        const rect = node.getBoundingClientRect()
        return {
          x: rect.left - wrapperRect.left + rect.width / 2,
          y: rect.top - wrapperRect.top + rect.height / 2,
        }
      }

      setSlotCenters({
        leftA: getCenter(leftARef.current),
        leftB: getCenter(leftBRef.current),
        right: getCenter(rightRef.current),
      })
    }

    measureLayout()

    const observer = new ResizeObserver(() => {
      measureLayout()
    })

    if (containerRef.current) observer.observe(containerRef.current)
    if (equationAreaRef.current) observer.observe(equationAreaRef.current)
    if (leftARef.current) observer.observe(leftARef.current)
    if (leftBRef.current) observer.observe(leftBRef.current)
    if (rightRef.current) observer.observe(rightRef.current)

    window.addEventListener("resize", measureLayout)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measureLayout)
    }
  }, [circleSize])

  useEffect(() => {
    if (!isDraggingArcEnd) return

    const handlePointerMove = (event: PointerEvent) => {
      const wrapper = equationAreaRef.current
      if (!wrapper) return

      const rect = wrapper.getBoundingClientRect()
      const x = clamp(event.clientX - rect.left, 0, rect.width)
      const y = clamp(event.clientY - rect.top, 0, rect.height)

      setDragPointer({ x, y })
    }

    const handlePointerUp = () => {
      const pointer = dragPointer
      if (pointer) {
        let nearestSlot: EquationSlot = SLOT_ORDER[0]
        let nearestDistance = Number.POSITIVE_INFINITY

        for (const slot of SLOT_ORDER) {
          const center = slotCenters[slot]
          const nextDistance = distance(pointer, center)
          if (nextDistance < nearestDistance) {
            nearestDistance = nextDistance
            nearestSlot = slot
          }
        }

        onEventVisualChange({
          ...eventVisual,
          mode: "drag",
          dragStartSlot,
          dragEndSlot: nearestSlot,
        })
      }

      setIsDraggingArcEnd(false)
      setDragPointer(null)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [dragPointer, dragStartSlot, eventVisual, isDraggingArcEnd, onEventVisualChange, slotCenters])

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

  const handleDropOnSlot = (slot: EquationSlot, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    const equationBlock =
      event.dataTransfer.getData("application/x-equation-block") ||
      event.dataTransfer.getData("text/plain")

    const hitEllipse = event.dataTransfer.getData("application/x-hit-ellipse")

    if (hitEllipse) {
      const rect = event.currentTarget.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const relativeX = event.clientX - centerX
      const nextMode = inferHitModeFromDrop(relativeX)

      onEventVisualChange({
        ...eventVisual,
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
    const isDragStart = eventVisual.mode === "drag" && dragStartSlot === slot

    return (
      <div
        ref={slotRefs[slot]}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => handleDropOnSlot(slot, event)}
        onClick={() => {
          if (eventVisual.mode !== "drag") return

          onEventVisualChange({
            ...eventVisual,
            mode: "drag",
            dragStartSlot: slot,
            dragEndSlot:
              eventVisual.dragEndSlot && eventVisual.dragEndSlot !== slot
                ? eventVisual.dragEndSlot
                : slot === "right"
                  ? "leftB"
                  : "right",
          })
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          outline: "2px dashed transparent",
          position: "relative",
          zIndex: 3,
          minWidth: `${circleSize}px`,
          minHeight: `${circleSize}px`,
          cursor: eventVisual.mode === "drag" ? "pointer" : "default",
          boxShadow: isDragStart ? "0 0 0 3px rgba(239, 68, 68, 0.55)" : "none",
        }}
      >
        {renderHitEllipses(slot)}

        <div style={{ position: "relative", zIndex: 4 }}>
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

  const currentDragStartCenter = slotCenters[dragStartSlot]
  const currentDragEndCenter = dragPointer ?? slotCenters[dragEndSlot]
  const shouldRenderDrag =
    eventVisual.mode === "drag" &&
    currentDragStartCenter.x > 0 &&
    currentDragEndCenter.x > 0

  const circleRadius = circleSize / 2
  const dragStrokeWidth = Math.max(20, circleSize * 0.8)

  const dragPath = shouldRenderDrag
    ? (() => {
        const startX = currentDragStartCenter.x
        const startY = currentDragStartCenter.y + circleRadius * 0.45
        const endX = currentDragEndCenter.x
        const endY = currentDragEndCenter.y
        const controlY = Math.max(startY, endY) + circleSize * 2.2

        return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`
      })()
    : null

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
          Drag number blocks onto circles. Drag the ellipse marker onto a circle to set the hit layout. In drag mode, click a circle to choose the drag start, then drag the end cap onto any circle.
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
          ref={equationAreaRef}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            padding: "28px 20px 80px 20px",
            minWidth: "max-content",
          }}
        >
          {shouldRenderDrag && dragPath ? (
            <>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${Math.max(
                  currentDragStartCenter.x,
                  currentDragEndCenter.x,
                  slotCenters.leftA.x,
                  slotCenters.leftB.x,
                  slotCenters.right.x
                ) + circleSize} ${Math.max(
                  currentDragStartCenter.y,
                  currentDragEndCenter.y,
                  slotCenters.leftA.y,
                  slotCenters.leftB.y,
                  slotCenters.right.y
                ) + circleSize * 3}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "visible",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="35%" stopColor="#f59e0b" />
                    <stop offset="65%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#6b7280" />
                  </linearGradient>
                </defs>

                <path
                  d={dragPath}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={dragStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.72}
                />
              </svg>

              <div
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsDraggingArcEnd(true)

                  const wrapper = equationAreaRef.current
                  if (!wrapper) return

                  const rect = wrapper.getBoundingClientRect()
                  setDragPointer({
                    x: clamp(event.clientX - rect.left, 0, rect.width),
                    y: clamp(event.clientY - rect.top, 0, rect.height),
                  })
                }}
                style={{
                  position: "absolute",
                  left: currentDragEndCenter.x - circleRadius,
                  top: currentDragEndCenter.y - circleRadius,
                  width: circleSize,
                  height: circleSize,
                  borderRadius: "9999px",
                  border: "2px solid rgba(255,255,255,0.52)",
                  background: "rgba(31, 41, 55, 0.92)",
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.18)",
                  zIndex: 2,
                  cursor: isDraggingArcEnd ? "grabbing" : "grab",
                }}
              />
            </>
          ) : null}

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
              zIndex: 4,
            }}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option} style={{ color: "#111827" }}>
                {option}
              </option>
            ))}
          </select>

          {renderDroppableCircle("leftB", value.leftB, "2")}

          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${equalsFontSize}px`,
              lineHeight: 1,
              display: "inline-block",
              color: "#FFFFFF",
              position: "relative",
              zIndex: 4,
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
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          Current equation:{" "}
          <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
            {value.leftA} {value.operatorA} {value.leftB} {value.equals} {value.right}
          </span>
        </div>

        {eventVisual.mode === "drag" ? (
          <div>
            Drag route:{" "}
            <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
              {dragStartSlot} → {dragEndSlot}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}