"use client"

import Image from "next/image"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
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

export type DraggedEquationToken = {
  kind: EquationTokenKind
  value: string
}

type EventEquationEditorProps = {
  value: EquationValue
  draggedPaletteToken?: DraggedEquationToken | null
  onChange: (value: EquationValue) => void
  eventVisual: EventVisualBinding
  onEventVisualChange: (value: EventVisualBinding) => void
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

function getTokenFontSize(value: string, size: number) {
  const length = value.length
  if (length <= 1) return size * 0.42
  if (length === 2) return size * 0.34
  return size * 0.28
}

function canReplaceToken(target: EquationToken, dragged: DraggedEquationToken) {
  return target.kind === dragged.kind
}

function canInsertIntoGap(dragged: DraggedEquationToken) {
  return dragged.kind === "circle" || dragged.kind === "operator" || dragged.kind === "equals"
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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
    () => getTokenFontSize(internalValue || value || "", size),
    [internalValue, value, size]
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
  draggedPaletteToken = null,
  onChange,
  eventVisual,
  onEventVisualChange,
}: EventEquationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const equationAreaRef = useRef<HTMLDivElement | null>(null)
  const tokenRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [circleSize, setCircleSize] = useState(72)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [tokenCenters, setTokenCenters] = useState<Record<string, { x: number; y: number }>>({})
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null)

  const reactId = useId()
  const gradientId = useMemo(
    () => `drag-gradient-${reactId.replace(/:/g, "")}`,
    [reactId]
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateBaseSize = () => {
      const width = element.clientWidth
      const next = clamp(width * 0.075, 60, 92)
      setCircleSize(next)
    }

    updateBaseSize()

    const observer = new ResizeObserver(() => updateBaseSize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const equationScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height || !naturalSize.width || !naturalSize.height) {
      return 1
    }

    const horizontal = (viewportSize.width - 24) / naturalSize.width
    const vertical = (viewportSize.height - 24) / naturalSize.height
    return clamp(Math.min(horizontal, vertical, 1), 0.35, 1)
  }, [viewportSize, naturalSize])

  useLayoutEffect(() => {
    const measureLayout = () => {
      const viewport = viewportRef.current
      const wrapper = equationAreaRef.current
      if (!viewport || !wrapper) return

      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      })

      const naturalWidth = wrapper.scrollWidth
      const naturalHeight = wrapper.scrollHeight

      setNaturalSize({
        width: naturalWidth,
        height: naturalHeight,
      })

      const wrapperRect = wrapper.getBoundingClientRect()
      const safeScale = equationScale || 1
      const nextCenters: Record<string, { x: number; y: number }> = {}

      Object.entries(tokenRefs.current).forEach(([tokenId, node]) => {
        if (!node) return
        const rect = node.getBoundingClientRect()
        nextCenters[tokenId] = {
          x: (rect.left - wrapperRect.left) / safeScale + rect.width / (2 * safeScale),
          y: (rect.top - wrapperRect.top) / safeScale + rect.height / (2 * safeScale),
        }
      })

      setTokenCenters(nextCenters)
    }

    measureLayout()

    const observer = new ResizeObserver(() => measureLayout())
    if (containerRef.current) observer.observe(containerRef.current)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (equationAreaRef.current) observer.observe(equationAreaRef.current)
    Object.values(tokenRefs.current).forEach((node) => node && observer.observe(node))

    window.addEventListener("resize", measureLayout)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measureLayout)
    }
  }, [value, circleSize, equationScale])

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

  const removeTokenById = (tokenId: string) => {
    if (value.length <= 1) return

    const next = value.filter((token) => token.id !== tokenId)
    if (next.length === 0) return

    onChange(next)
    setHoveredTokenId((current) => (current === tokenId ? null : current))

    if (
      eventVisual.hitAnchorTokenId === tokenId ||
      eventVisual.dragStartTokenId === tokenId ||
      eventVisual.dragEndTokenId === tokenId
    ) {
      const firstCircle = next.find((token) => token.kind === "circle")?.id ?? null

      onEventVisualChange({
        ...eventVisual,
        hitAnchorTokenId:
          eventVisual.hitAnchorTokenId === tokenId ? firstCircle : eventVisual.hitAnchorTokenId,
        dragStartTokenId:
          eventVisual.dragStartTokenId === tokenId ? null : eventVisual.dragStartTokenId,
        dragEndTokenId:
          eventVisual.dragEndTokenId === tokenId ? null : eventVisual.dragEndTokenId,
      })
    }
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

    const draggedToken = draggedPaletteToken ?? parseDraggedToken(event)
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

    const dx = endCap.x - startCap.x
    const absDx = Math.abs(dx)
    const isRightToLeft = dx < 0
    const depth = Math.max(circleSize * 1.82, absDx * 0.48)
    const controlY = Math.max(startCap.y, endCap.y) + depth
    const controlOffset = Math.max(circleSize * 0.9, absDx * 0.22)

    const c1x = isRightToLeft ? startCap.x + controlOffset : startCap.x - controlOffset
    const c2x = isRightToLeft ? endCap.x - controlOffset : endCap.x + controlOffset

    const path = `M ${startCap.x} ${startCap.y}
      C ${c1x} ${controlY},
        ${c2x} ${controlY},
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

  const renderToken = (token: EquationToken) => {
    const isDragStart = eventVisual.mode === "drag" && eventVisual.dragStartTokenId === token.id
    const isDragEnd = eventVisual.mode === "drag" && eventVisual.dragEndTokenId === token.id
    const isCircle = token.kind === "circle"
    const showRemove = hoveredTokenId === token.id && value.length > 1

    return (
      <div
        key={token.id}
        ref={(node) => {
          tokenRefs.current[token.id] = node
        }}
        onMouseEnter={() => setHoveredTokenId(token.id)}
        onMouseLeave={() => setHoveredTokenId((current) => (current === token.id ? null : current))}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "copy"
        }}
        onDrop={(event) => handleDropOnToken(token.id, event)}
        onClick={() => {
          if (isCircle) handleDragTokenSelection(token.id)
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 4,
          minWidth: isCircle ? `${circleSize}px` : `${Math.max(42, circleSize * 0.78)}px`,
          minHeight: isCircle ? `${circleSize}px` : `${Math.max(42, circleSize * 0.78)}px`,
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

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            removeTokenById(token.id)
          }}
          style={{
            position: "absolute",
            top: "-10px",
            right: "-10px",
            width: "22px",
            height: "22px",
            borderRadius: "9999px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "#0f172a",
            color: "#FFFFFF",
            fontSize: "14px",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            padding: 0,
            opacity: showRemove ? 1 : 0,
            pointerEvents: showRemove ? "auto" : "none",
            transition: "opacity 120ms ease",
          }}
          aria-label={`Remove ${token.kind}`}
          title="Remove"
        >
          ×
        </button>

        <div style={{ position: "relative", zIndex: 5 }}>
          {token.kind === "circle" ? (
            <EquationCircle
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
      onDragEnter={(event) => {
        const draggedToken = draggedPaletteToken ?? parseDraggedToken(event)
        if (!draggedToken || !canInsertIntoGap(draggedToken)) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onDragOver={(event) => {
        const draggedToken = draggedPaletteToken ?? parseDraggedToken(event)
        if (!draggedToken || !canInsertIntoGap(draggedToken)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = "copy"
      }}
      onDrop={(event) => {
        const draggedToken = draggedPaletteToken ?? parseDraggedToken(event)
        if (!draggedToken || !canInsertIntoGap(draggedToken)) return
        event.preventDefault()
        event.stopPropagation()
        insertTokenAtIndex(index, draggedToken)
      }}
      style={{
        width: `${Math.max(28, circleSize * 0.52)}px`,
        minWidth: `${Math.max(28, circleSize * 0.52)}px`,
        height: `${Math.max(circleSize + 12, 72)}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 20,
        cursor: "copy",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          width: `${Math.max(6, circleSize * 0.12)}px`,
          height: "78%",
          borderRadius: "999px",
          background: "rgba(255,255,255,0.24)",
        }}
      />
    </div>
  )

  const scaledWidth = naturalSize.width * equationScale
  const scaledHeight = naturalSize.height * equationScale

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
        minWidth: 0,
        overflow: "hidden",
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
          Drop onto matching token types to replace them. Drag circles, operators, or equals signs into a gap to extend the equation.
        </p>
      </div>

      <div
        ref={viewportRef}
        style={{
          flex: 1,
          width: "100%",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            width: `${scaledWidth || 1}px`,
            height: `${scaledHeight || 1}px`,
            flex: "0 0 auto",
            maxWidth: "100%",
            maxHeight: "100%",
            overflow: "hidden",
          }}
        >
          <div
            ref={equationAreaRef}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `scale(${equationScale})`,
              transformOrigin: "top left",
              width: "max-content",
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
            {dragGeometry && naturalSize.width > 0 && naturalSize.height > 0 ? (
              <svg
                width={naturalSize.width}
                height={naturalSize.height}
                viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
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

            {renderInsertGap(0)}
            {value.map((token, index) => (
              <div
                key={`wrap-${token.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {renderToken(token)}
                {renderInsertGap(index + 1)}
              </div>
            ))}
          </div>
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
