"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import type { EditorEventMode } from "./EventTypePalette"

export type EquationTokenKind = "circle" | "operator" | "equals"

export type EquationToken = {
  id: string
  kind: EquationTokenKind
  value: string
}

export type EquationValue = EquationToken[]

export type EquationTokenId = string

export type EventVisualBinding = {
  mode: EditorEventMode
  hitAnchorTokenId: EquationTokenId | null
  dragStartTokenId?: EquationTokenId | null
  dragEndTokenId?: EquationTokenId | null
}

type EventEquationEditorProps = {
  value: EquationValue
  onChange: (value: EquationValue) => void
  eventVisual: EventVisualBinding
  onEventVisualChange: (value: EventVisualBinding) => void
}

type DraggedEquationToken = {
  kind: EquationTokenKind
  value: string
}

function createToken(kind: EquationTokenKind, value: string): EquationToken {
  return {
    id: crypto.randomUUID(),
    kind,
    value,
  }
}

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

function parseDraggedToken(event: React.DragEvent) {
  const raw = event.dataTransfer.getData("application/x-equation-token")
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as DraggedEquationToken
    if (!parsed || !parsed.kind) return null
    return parsed
  } catch {
    return null
  }
}

function getTokenFontSize(value: string) {
  if (value.length <= 1) return 30
  if (value.length === 2) return 24
  return 20
}

function canReplaceToken(target: EquationToken, dragged: DraggedEquationToken) {
  return target.kind === dragged.kind
}

function canInsertIntoGap(dragged: DraggedEquationToken) {
  return dragged.kind === "circle" || dragged.kind === "operator"
}

export function EquationCircle({
  value = "",
  onChange,
  size = 72,
  readOnly = false,
  imageSrc = "/images/equation-circle.png",
}: {
  value?: string
  onChange?: (value: string) => void
  size?: number
  readOnly?: boolean
  imageSrc?: string
}) {
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const fontSize = useMemo(
    () => getTokenFontSize(internalValue || value || ""),
    [internalValue, value]
  )

  const handleChange = (nextValue: string) => {
    const sanitized = nextValue.replace(/\s+/g, "")
    setInternalValue(sanitized)
    onChange?.(sanitized)
  }

  return (
    <div
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        flex: "0 0 auto",
      }}
    >
      <Image
        src={imageSrc}
        alt="Equation circle"
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        {readOnly ? (
          <span
            style={{
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              WebkitTextFillColor: "#FFFFFF",
              textShadow: "0 0 4px rgba(0,0,0,0.85)",
              width: "68%",
              textAlign: "center",
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {value}
          </span>
        ) : (
          <input
            type="text"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            style={{
              display: "block",
              width: "68%",
              border: "none",
              outline: "none",
              background: "transparent",
              textAlign: "center",
              fontFamily: "var(--font-grandstander)",
              fontWeight: 700,
              fontSize: `${fontSize}px`,
              color: "#FFFFFF",
              WebkitTextFillColor: "#FFFFFF",
              textShadow: "0 0 4px rgba(0,0,0,0.85)",
              lineHeight: 1,
              caretColor: "#FFFFFF",
              padding: 0,
              margin: 0,
              position: "relative",
              zIndex: 3,
            }}
          />
        )}
      </div>
    </div>
  )
}

export function EventEquationEditor({
  value,
  onChange,
  eventVisual,
  onEventVisualChange,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const equationAreaRef = useRef<HTMLDivElement | null>(null)
  const tokenRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [circleSize, setCircleSize] = useState(72)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [tokenCenters, setTokenCenters] = useState<Record<string, { x: number; y: number }>>({})

  const gradientId = useMemo(
    () => `drag-gradient-${Math.random().toString(36).slice(2)}`,
    []
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const width = element.clientWidth
      const next = Math.max(60, Math.min(width * 0.075, 92))
      setCircleSize(next)
    }

    updateSize()

    const observer = new ResizeObserver(() => updateSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const measureLayout = () => {
      const wrapper = equationAreaRef.current
      if (!wrapper) return

      const wrapperRect = wrapper.getBoundingClientRect()

      setCanvasSize({
        width: wrapperRect.width,
        height: wrapperRect.height,
      })

      const nextCenters: Record<string, { x: number; y: number }> = {}

      Object.entries(tokenRefs.current).forEach(([tokenId, node]) => {
        if (!node) return
        const rect = node.getBoundingClientRect()
        nextCenters[tokenId] = {
          x: rect.left - wrapperRect.left + rect.width / 2,
          y: rect.top - wrapperRect.top + rect.height / 2,
        }
      })

      setTokenCenters(nextCenters)
    }

    measureLayout()

    const observer = new ResizeObserver(() => measureLayout())
    if (containerRef.current) observer.observe(containerRef.current)
    if (equationAreaRef.current) observer.observe(equationAreaRef.current)

    Object.values(tokenRefs.current).forEach((node) => {
      if (node) observer.observe(node)
    })

    window.addEventListener("resize", measureLayout)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measureLayout)
    }
  }, [value, circleSize])

  const operatorFontSize = useMemo(
    () => Math.max(24, Math.min(circleSize * 0.72, 38)),
    [circleSize]
  )

  const equalsFontSize = useMemo(
    () => Math.max(26, Math.min(circleSize * 0.82, 42)),
    [circleSize]
  )

  const circleTokenIds = useMemo(
    () => value.filter((token) => token.kind === "circle").map((token) => token.id),
    [value]
  )

  const handleTokenValueChange = (tokenId: string, nextValue: string) => {
    onChange(
      value.map((token) =>
        token.id === tokenId ? { ...token, value: nextValue } : token
      )
    )
  }

  const replaceToken = (tokenId: string, payload: DraggedEquationToken) => {
    onChange(
      value.map((token) => {
        if (token.id !== tokenId) return token
        if (!canReplaceToken(token, payload)) return token
        return { ...token, kind: payload.kind, value: payload.value }
      })
    )
  }

  const insertTokenAtIndex = (index: number, payload: DraggedEquationToken) => {
    if (!canInsertIntoGap(payload)) return

    const nextToken = createToken(payload.kind, payload.value)
    const next = [...value]
    next.splice(index, 0, nextToken)
    onChange(next)
  }

  const handleDropOnToken = (tokenId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    const draggedToken = parseDraggedToken(event)
    const hitEllipse = event.dataTransfer.getData("application/x-hit-ellipse")

    if (hitEllipse) {
      const targetToken = value.find((token) => token.id === tokenId)
      if (!targetToken || targetToken.kind !== "circle") return

      const rect = event.currentTarget.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const relativeX = event.clientX - centerX
      const nextMode = inferHitModeFromDrop(relativeX)

      onEventVisualChange({
        ...eventVisual,
        mode: nextMode,
        hitAnchorTokenId: tokenId,
      })
      return
    }

    if (draggedToken) {
      replaceToken(tokenId, draggedToken)
    }
  }

  const handleDropOnInsertGap = (index: number, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const draggedToken = parseDraggedToken(event)
    if (!draggedToken) return
    insertTokenAtIndex(index, draggedToken)
  }

  const handleDragTokenSelection = (tokenId: string) => {
    if (eventVisual.mode !== "drag") return
    if (!circleTokenIds.includes(tokenId)) return

    const currentStart = eventVisual.dragStartTokenId ?? null
    const currentEnd = eventVisual.dragEndTokenId ?? null

    if (!currentStart) {
      onEventVisualChange({
        ...eventVisual,
        mode: "drag",
        dragStartTokenId: tokenId,
        dragEndTokenId: null,
      })
      return
    }

    if (currentStart && !currentEnd) {
      if (tokenId === currentStart) return

      onEventVisualChange({
        ...eventVisual,
        mode: "drag",
        dragStartTokenId: currentStart,
        dragEndTokenId: tokenId,
      })
      return
    }

    onEventVisualChange({
      ...eventVisual,
      mode: "drag",
      dragStartTokenId: tokenId,
      dragEndTokenId: null,
    })
  }

  const renderHitEllipses = (tokenId: string) => {
    const isHitMode =
      eventVisual.mode === "hit_vertical" ||
      eventVisual.mode === "hit_diagonal_left" ||
      eventVisual.mode === "hit_diagonal_right"

    if (!isHitMode || eventVisual.hitAnchorTokenId !== tokenId) return null

    const markerSize = Math.round(circleSize * 0.62)
    const offsets = getHitEllipseOffsets(eventVisual.mode, circleSize)

    return offsets.map((offset, index) => (
      <Image
        key={`${tokenId}-${eventVisual.mode}-${index}`}
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

  const shouldRenderDrag =
    eventVisual.mode === "drag" &&
    !!eventVisual.dragStartTokenId &&
    !!eventVisual.dragEndTokenId &&
    eventVisual.dragStartTokenId !== eventVisual.dragEndTokenId &&
    tokenCenters[eventVisual.dragStartTokenId] &&
    tokenCenters[eventVisual.dragEndTokenId]

  const dragGeometry = useMemo(() => {
    if (!shouldRenderDrag) return null

    const startCenter = tokenCenters[eventVisual.dragStartTokenId as string]
    const endCenter = tokenCenters[eventVisual.dragEndTokenId as string]
    if (!startCenter || !endCenter) return null

    const circleRadius = circleSize / 2
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
    eventVisual.dragStartTokenId,
    eventVisual.dragEndTokenId,
    tokenCenters,
    circleSize,
  ])

  const renderToken = (token: any) => {
    const isDragStart = eventVisual.mode === "drag" && eventVisual.dragStartTokenId === token.id
    const isDragEnd = eventVisual.mode === "drag" && eventVisual.dragEndTokenId === token.id
    const isCircle = token.kind === "circle"

    return (
      <div
        key={token.id}
        ref={(node) => {
          tokenRefs.current[token.id] = node
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => handleDropOnToken(token.id, event)}
        onClick={() => {
          if (isCircle) {
            handleDragTokenSelection(token.id)
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 4,
          minWidth: isCircle ? `${circleSize}px` : "56px",
          minHeight: isCircle ? `${circleSize}px` : "56px",
          cursor: eventVisual.mode === "drag" && isCircle ? "pointer" : "default",
          boxShadow: isDragStart
            ? "0 0 0 3px rgba(239, 68, 68, 0.6)"
            : isDragEnd
              ? "0 0 0 3px rgba(255,255,255,0.25)"
              : "none",
          borderRadius: "9999px",
        }}
      >
        {isCircle ? renderHitEllipses(token.id) : null}

        <div style={{ position: "relative", zIndex: 5 }}>
          {token.kind === "circle" ? (
            <EventEquationEditor.EquationCircle
              value={token.value}
              onChange={(next: string) => handleTokenValueChange(token.id, next)}
              size={circleSize}
            />
          ) : token.kind === "equals" ? (
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
              {token.value}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-grandstander)",
                fontWeight: 700,
                fontSize: `${operatorFontSize}px`,
                lineHeight: 1,
                display: "inline-block",
                color: "#FFFFFF",
                position: "relative",
                zIndex: 5,
              }}
            >
              {token.value}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderInsertGap = (index: number) => (
    <div
      key={`gap-${index}`}
      onDragOver={(event) => {
        const draggedToken = parseDraggedToken(event)
        if (!draggedToken || !canInsertIntoGap(draggedToken)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => handleDropOnInsertGap(index, event)}
      style={{
        width: "18px",
        minWidth: "18px",
        height: `${Math.max(circleSize, 56)}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 3,
      }}
    >
      <div
        style={{
          width: "4px",
          height: "70%",
          borderRadius: "999px",
          background: "rgba(255,255,255,0.12)",
        }}
      />
    </div>
  )

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
          Drop onto matching token types to replace them. Drag circles or operators into a gap to extend the equation.
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
            gap: "8px",
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

          {value.map((token, index) => (
            <div
              key={`wrap-${token.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {renderInsertGap(index)}
              {renderToken(token)}
              {index === value.length - 1 ? renderInsertGap(index + 1) : null}
            </div>
          ))}
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
            {value.map((token) => (token.kind === "circle" && token.value === "" ? "○" : token.value)).join(" ")}
          </span>
        </div>

        {eventVisual.mode === "drag" ? (
          <div>
            Drag selection:{" "}
            <span style={{ fontWeight: 600, color: "#FFFFFF" }}>
              start = {eventVisual.dragStartTokenId ?? "none"}, end = {eventVisual.dragEndTokenId ?? "none"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

EventEquationEditor.EquationCircle = function BoundEquationCircle(props: any) {
  return <EquationCircle {...props} />
}