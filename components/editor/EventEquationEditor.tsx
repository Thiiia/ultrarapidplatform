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

function inferHitModeFromDrop(relativeX: number): EditorEventMode {
  if (Math.abs(relativeX) < 10) return "hit_vertical"
  if (relativeX < 0) return "hit_diagonal_left"
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
  const equationAreaRef = useRef<HTMLDivElement | null>(null)

  const leftARef = useRef<HTMLDivElement | null>(null)
  const leftBRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)

  const [circleSize, setCircleSize] = useState(72)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [slotCenters, setSlotCenters] = useState<Record<EquationSlot, { x: number; y: number }>>({
    leftA: { x: 0, y: 0 },
    leftB: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  })

  const gradientId = useMemo(
    () => `drag-gradient-${Math.random().toString(36).slice(2)}`,
    []
  )

  const update = <K extends keyof EquationValue>(key: K, nextValue: EquationValue[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const width = element.clientWidth
      const next = Math.max(60, Math.min(width * 0.075, 92))
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
        if (!node) return { x: 0, y: 0 }
        const rect = node.getBoundingClientRect()
        return {
          x: rect.left - wrapperRect.left + rect.width / 2,
          y: rect.top - wrapperRect.top + rect.height / 2,
        }
      }

      setCanvasSize({
        width: wrapperRect.width,
        height: wrapperRect.height,
      })

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

  const operatorFontSize = useMemo(
    () => Math.max(24, Math.min(circleSize * 0.72, 38)),
    [circleSize]
  )

  const equalsFontSize = useMemo(
    () => Math.max(26, Math.min(circleSize * 0.82, 42)),
    [circleSize]
  )

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

  const handleDragSlotSelection = (slot: EquationSlot) => {
    if (eventVisual.mode !== "drag") return

    const currentStart = eventVisual.dragStartSlot ?? null
    const currentEnd = eventVisual.dragEndSlot ?? null

    if (!currentStart) {
      onEventVisualChange({
        ...eventVisual,
        mode: "drag",
        dragStartSlot: slot,
        dragEndSlot: null,
      })
      return
    }

    if (currentStart && !currentEnd) {
      if (slot === currentStart) return

      onEventVisualChange({
        ...eventVisual,
        mode: "drag",
        dragStartSlot: currentStart,
        dragEndSlot: slot,
      })
      return
    }

    onEventVisualChange({
      ...eventVisual,
      mode: "drag",
      dragStartSlot: slot,
      dragEndSlot: null,
    })
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
    placeholder: string,
    ref: React.RefObject<HTMLDivElement | null>
  ) => {
    const isDragStart = eventVisual.mode === "drag" && eventVisual.dragStartSlot === slot
    const isDragEnd = eventVisual.mode === "drag" && eventVisual.dragEndSlot === slot

    return (
      <div
        ref={ref}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => handleDropOnSlot(slot, event)}
        onClick={() => handleDragSlotSelection(slot)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          position: "relative",
          zIndex: 4,
          minWidth: `${circleSize}px`,
          minHeight: `${circleSize}px`,
          cursor: eventVisual.mode === "drag" ? "pointer" : "default",
          boxShadow: isDragStart
            ? "0 0 0 3px rgba(239, 68, 68, 0.6)"
            : isDragEnd
              ? "0 0 0 3px rgba(255,255,255,0.25)"
              : "none",
        }}
      >
        {renderHitEllipses(slot)}

        <div style={{ position: "relative", zIndex: 5 }}>
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

  const shouldRenderDrag =
    eventVisual.mode === "drag" &&
    !!eventVisual.dragStartSlot &&
    !!eventVisual.dragEndSlot &&
    eventVisual.dragStartSlot !== eventVisual.dragEndSlot

  const dragGeometry = useMemo(() => {
    if (!shouldRenderDrag) return null

    const startSlot = eventVisual.dragStartSlot as EquationSlot
    const endSlot = eventVisual.dragEndSlot as EquationSlot

    const startCenter = slotCenters[startSlot]
    const endCenter = slotCenters[endSlot]

    if (!startCenter || !endCenter) return null

const circleRadius = circleSize / 2

// Smaller offset = move the drag arc endpoints upward.
// 0.02 gives a much tighter fit directly under the equation circles.
const capCenterYOffset = circleRadius * 0.02

const startCap = {
  x: startCenter.x,
  y: startCenter.y + capCenterYOffset,
}

const endCap = {
  x: endCenter.x,
  y: endCenter.y + capCenterYOffset,
}

const span = Math.abs(endCap.x - startCap.x)
const depth = Math.max(circleSize * 1.82, span * 0.48)
const controlY = Math.max(startCap.y, endCap.y) + depth

    const path = `M ${startCap.x} ${startCap.y}
      C ${startCap.x} ${controlY},
        ${endCap.x} ${controlY},
        ${endCap.x} ${endCap.y}`

    return {
      startCap,
      endCap,
      path,
      capRadius: circleRadius,
    }
  }, [
    shouldRenderDrag,
    eventVisual.dragStartSlot,
    eventVisual.dragEndSlot,
    slotCenters,
    circleSize,
  ])

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
          Drag number blocks onto circles. Drag the ellipse marker onto a circle for hit layouts.
          In drag mode, click one circle for the start, then another for the end.
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
            padding: "28px 20px 110px 20px",
            minWidth: "max-content",
          }}
        >
          {dragGeometry && canvasSize.width > 0 && canvasSize.height > 0 ? (
            <svg
              width={canvasSize.width}
              height={canvasSize.height}
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
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
                  <stop offset="18%" stopColor="#f97316" />
                  <stop offset="42%" stopColor="#eab308" />
                  <stop offset="65%" stopColor="#bef264" />
                  <stop offset="100%" stopColor="#4b5563" />
                </linearGradient>
              </defs>

              <path
                d={dragGeometry.path}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={circleSize * 0.98}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={dragGeometry.path}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={circleSize * 0.88}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.84}
              />

              <circle
                cx={dragGeometry.startCap.x}
                cy={dragGeometry.startCap.y}
                r={dragGeometry.capRadius}
                fill="#46484d"
              />

              <circle
                cx={dragGeometry.endCap.x}
                cy={dragGeometry.endCap.y}
                r={dragGeometry.capRadius}
                fill="#46484d"
              />
            </svg>
          ) : null}

          {renderDroppableCircle("leftA", value.leftA, "X", leftARef)}

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
              zIndex: 5,
            }}
          >
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option} value={option} style={{ color: "#111827" }}>
                {option}
              </option>
            ))}
          </select>

          {renderDroppableCircle("leftB", value.leftB, "2", leftBRef)}

          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${equalsFontSize}px`,
              lineHeight: 1,
              display: "inline-block",
              color: "#FFFFFF",
              position: "relative",
              zIndex: 5,
            }}
          >
            {value.equals}
          </span>

          {renderDroppableCircle("right", value.right, "7", rightRef)}
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
            Drag selection:{" "}
            <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
              start = {eventVisual.dragStartSlot ?? "none"}, end = {eventVisual.dragEndSlot ?? "none"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}