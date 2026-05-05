"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EventEquationEditor, EquationValue } from "./EventEquationEditor"
import { EquationBlockPalette } from "./EquationBlockPalette"
import { EventTypePalette } from "./EventTypePalette"

type BrowserTimelinePanelProps = {
  songFile: File | null
  chartText: string
  chartFileName?: string
  onChartTextChange?: (nextChartText: string) => void
}

type ChartEventType = "hit" | "drag" | "spin"

type ParsedChartEvent = {
  id: string
  type: ChartEventType
  tick: number
  length: number
  lane: number
  seconds: number
  label: string
  color: { r: number; g: number; b: number }
}

type SyncBpmPoint = {
  tick: number
  bpm: number
}

type ParsedChartData = {
  resolution: number
  events: ParsedChartEvent[]
  hits: ParsedChartEvent[]
  drags: ParsedChartEvent[]
  spins: ParsedChartEvent[]
  maxTick: number
}

type TimelineSegment = {
  startSeconds: number
  endSeconds: number
  color: { r: number; g: number; b: number }
}

type EquationBindingsFile = {
  version: 1
  chartFileName: string
  chartSignature: string
  bindings: Record<string, EquationValue>
}

const HIT_COLOR = { r: 147, g: 51, b: 234 }
const DRAG_COLOR = { r: 220, g: 38, b: 38 }
const SPIN_COLOR = { r: 156, g: 163, b: 175 }
const EMPTY_COLOR = { r: 51, g: 65, b: 85 }

const DEFAULT_EQUATION: EquationValue = {
  leftA: "X",
  operatorA: "+",
  leftB: "2",
  equals: "=",
  right: "7",
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function laneLabel(lane: number) {
  const labels = ["G", "R", "Y", "B", "O"]
  return labels[lane] ?? String(lane)
}

function rgbToCss(color: { r: number; g: number; b: number }) {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}

function averageColors(colors: Array<{ r: number; g: number; b: number }>) {
  if (!colors.length) return EMPTY_COLOR

  const total = colors.reduce(
    (acc, color) => {
      acc.r += color.r
      acc.g += color.g
      acc.b += color.b
      return acc
    },
    { r: 0, g: 0, b: 0 }
  )

  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
  }
}

function parseResolution(chartText: string) {
  const match = chartText.match(/\[Song\][\s\S]*?Resolution\s*=\s*"?(\d+)"?/i)
  const value = match?.[1]
  const parsed = value ? Number(value) : 192
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 192
}

function parseSyncTrack(chartText: string) {
  const syncSectionMatch = chartText.match(/\[SyncTrack\]\s*\{([\s\S]*?)\}/i)
  if (!syncSectionMatch) return [{ tick: 0, bpm: 120 }]

  const section = syncSectionMatch[1]
  const matches = [...section.matchAll(/^\s*(\d+)\s*=\s*B\s+(\d+)/gm)]

  const points: SyncBpmPoint[] = matches
    .map((match) => {
      const tick = Number(match[1])
      const raw = Number(match[2])
      return { tick, bpm: raw / 1000 }
    })
    .filter((point) => Number.isFinite(point.tick) && Number.isFinite(point.bpm) && point.bpm > 0)
    .sort((a, b) => a.tick - b.tick)

  if (!points.length || points[0].tick !== 0) {
    return [{ tick: 0, bpm: 120 }, ...points]
  }

  return points
}

function tickToSeconds(tick: number, resolution: number, bpmPoints: SyncBpmPoint[]) {
  if (tick <= 0) return 0

  let totalSeconds = 0

  for (let i = 0; i < bpmPoints.length; i++) {
    const current = bpmPoints[i]
    const next = bpmPoints[i + 1]
    const segmentStart = current.tick
    const segmentEnd = next ? next.tick : tick

    if (tick <= segmentStart) break

    const effectiveEnd = Math.min(tick, segmentEnd)
    const deltaTicks = effectiveEnd - segmentStart

    if (deltaTicks > 0) {
      const beats = deltaTicks / resolution
      totalSeconds += beats * (60 / current.bpm)
    }

    if (!next || tick < next.tick) break
  }

  return totalSeconds
}

function parseTrackSection(chartText: string) {
  const preferredSections = [
    "ExpertSingle",
    "HardSingle",
    "MediumSingle",
    "EasySingle",
    "ExpertDrums",
    "HardDrums",
    "MediumDrums",
    "EasyDrums",
  ]

  for (const sectionName of preferredSections) {
    const regex = new RegExp(`\\[${sectionName}\\]\\s*\\{([\\s\\S]*?)\\}`, "i")
    const match = chartText.match(regex)
    if (match) return match[1]
  }

  return ""
}

function buildEventId(type: ChartEventType, tick: number, lane: number, length: number, index: number) {
  return `${type}:${tick}:${lane}:${length}:${index}`
}

function parseChartData(chartText: string): ParsedChartData {
  if (!chartText.trim()) {
    return {
      resolution: 192,
      events: [],
      hits: [],
      drags: [],
      spins: [],
      maxTick: 0,
    }
  }

  const resolution = parseResolution(chartText)
  const bpmPoints = parseSyncTrack(chartText)
  const trackSection = parseTrackSection(chartText)

  const noteMatches = [...trackSection.matchAll(/^\s*(\d+)\s*=\s*N\s+(\d+)\s+(\d+)/gm)]

  const noteEvents: ParsedChartEvent[] = noteMatches
    .map((match, index) => {
      const tick = Number(match[1])
      const lane = Number(match[2])
      const length = Number(match[3])
      const type: ChartEventType = length > 0 ? "drag" : "hit"
      const color = type === "drag" ? DRAG_COLOR : HIT_COLOR

      return {
        id: buildEventId(type, tick, lane, length, index),
        type,
        tick,
        lane,
        length,
        seconds: tickToSeconds(tick, resolution, bpmPoints),
        label: type === "drag" ? `Drag lane ${laneLabel(lane)}` : `Hit lane ${laneLabel(lane)}`,
        color,
      }
    })
    .filter((event) =>
      Number.isFinite(event.tick) &&
      Number.isFinite(event.lane) &&
      Number.isFinite(event.length) &&
      Number.isFinite(event.seconds)
    )
    .sort((a, b) => a.seconds - b.seconds)

  const hits = noteEvents.filter((event) => event.type === "hit")
  const drags = noteEvents.filter((event) => event.type === "drag")
  const spins: ParsedChartEvent[] = []

  const events = [...hits, ...drags, ...spins].sort((a, b) => a.seconds - b.seconds)
  const maxTick = events.length ? Math.max(...events.map((event) => event.tick)) : 0

  return { resolution, events, hits, drags, spins, maxTick }
}

function getNearbyEvents(events: ParsedChartEvent[], currentTime: number, windowSeconds = 3) {
  return events.filter((event) => Math.abs(event.seconds - currentTime) <= windowSeconds)
}

function buildTimelineSegments(
  events: ParsedChartEvent[],
  duration: number,
  sliderWidthPx = 1200,
  segmentWidthPx = 4
): TimelineSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) return []

  const segmentCount = Math.max(1, Math.ceil(sliderWidthPx / segmentWidthPx))
  const secondsPerSegment = duration / segmentCount
  const segments: TimelineSegment[] = []

  for (let i = 0; i < segmentCount; i++) {
    const startSeconds = i * secondsPerSegment
    const endSeconds = i === segmentCount - 1 ? duration : (i + 1) * secondsPerSegment

    const segmentEvents = events.filter(
      (event) => event.seconds >= startSeconds && event.seconds < endSeconds
    )

    const color = averageColors(segmentEvents.map((event) => event.color))
    segments.push({ startSeconds, endSeconds, color })
  }

  return segments
}

function buildSegmentGradient(segments: TimelineSegment[], duration: number) {
  if (!segments.length || duration <= 0) return "#334155"

  const stops: string[] = []

  for (const segment of segments) {
    const startPercent = (segment.startSeconds / duration) * 100
    const endPercent = (segment.endSeconds / duration) * 100
    const color = rgbToCss(segment.color)

    stops.push(`${color} ${startPercent}%`, `${color} ${endPercent}%`)
  }

  return `linear-gradient(to right, ${stops.join(", ")})`
}

function getCurrentEventIndex(events: ParsedChartEvent[], currentTime: number) {
  if (!events.length) return -1

  let closestIndex = 0
  let closestDistance = Math.abs(events[0].seconds - currentTime)

  for (let i = 1; i < events.length; i++) {
    const distance = Math.abs(events[i].seconds - currentTime)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  return closestIndex
}

function buildChartSignature(parsed: ParsedChartData) {
  return `${parsed.resolution}:${parsed.maxTick}:${parsed.events.length}`
}

function downloadEquationBindings(fileName: string, content: EquationBindingsFile) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function updateChartEventType(
  chartText: string,
  event: ParsedChartEvent,
  nextType: ChartEventType
) {
  if (nextType === "spin") {
    return chartText
  }

  const currentLength = event.length
  const nextLength = nextType === "hit" ? 0 : currentLength > 0 ? currentLength : 240

  const escapedTick = String(event.tick).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const escapedLane = String(event.lane).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const escapedLength = String(event.length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const pattern = new RegExp(
    `(^\\s*${escapedTick}\\s*=\\s*N\\s+${escapedLane}\\s+)${escapedLength}(\\s*$)`,
    "m"
  )

  return chartText.replace(pattern, `$1${nextLength}$2`)
}

function HorizontalDotPanel({
  title,
  events,
  dotClassName,
}: {
  title: string
  events: ParsedChartEvent[]
  dotClassName: string
}) {
  return (
    <div style={{ borderRadius: "16px", border: "1px solid #334155", padding: "16px", background: "#1e293b", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#FFFFFF" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: "14px", color: "#cbd5e1" }}>Count: {events.length}</p>
      </div>

      <div style={{ borderRadius: "12px", border: "1px solid #334155", background: "#0f172a", padding: "12px", minHeight: "56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {events.length === 0 ? (
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>No nearby events.</div>
          ) : (
            events.map((event, index) => (
              <div
                key={`${title}-${event.tick}-${event.lane}-${index}`}
                title={`${event.label} • ${formatTime(event.seconds)} • tick ${event.tick} • lane ${laneLabel(event.lane)}`}
                className={dotClassName}
                style={{ width: "12px", height: "12px", borderRadius: "9999px", flexShrink: 0 }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function BrowserTimelinePanel({
  songFile,
  chartText,
  chartFileName = "chart.chart",
  onChartTextChange,
}: BrowserTimelinePanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [audioUrl, setAudioUrl] = useState("")
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const parsed = useMemo(() => parseChartData(chartText), [chartText])
  const chartSignature = useMemo(() => buildChartSignature(parsed), [parsed])

  const [equationsByEventId, setEquationsByEventId] = useState<Record<string, EquationValue>>({})

  useEffect(() => {
    setEquationsByEventId((prev) => {
      const nextBindings: Record<string, EquationValue> = {}
      parsed.events.forEach((event) => {
        nextBindings[event.id] = prev[event.id] ?? { ...DEFAULT_EQUATION }
      })
      return nextBindings
    })
  }, [parsed])

  useEffect(() => {
    if (!songFile) {
      setAudioUrl("")
      setDuration(0)
      setCurrentTime(0)
      setIsPlaying(false)
      return
    }

    const url = URL.createObjectURL(songFile)
    setAudioUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [songFile])

  const timelineSegments = useMemo(
    () => buildTimelineSegments(parsed.events, duration, 1200, 4),
    [parsed.events, duration]
  )

  const timelineGradient = useMemo(
    () => buildSegmentGradient(timelineSegments, duration),
    [timelineSegments, duration]
  )

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration || 0)
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
  }

  const handleSliderChange = (value: number) => {
    const audio = audioRef.current
    setCurrentTime(value)
    if (audio) audio.currentTime = value
  }

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const nearbyHits = useMemo(() => getNearbyEvents(parsed.hits, currentTime), [parsed.hits, currentTime])
  const nearbyDrags = useMemo(() => getNearbyEvents(parsed.drags, currentTime), [parsed.drags, currentTime])
  const nearbySpins = useMemo(() => getNearbyEvents(parsed.spins, currentTime), [parsed.spins, currentTime])

  const currentEventIndex = useMemo(() => getCurrentEventIndex(parsed.events, currentTime), [parsed.events, currentTime])
  const currentEvent = currentEventIndex >= 0 ? parsed.events[currentEventIndex] : null
  const currentEquation = currentEvent ? equationsByEventId[currentEvent.id] ?? DEFAULT_EQUATION : null

  const chartPosition = duration > 0 ? currentTime / duration : 0
  const estimatedChartTick = Math.round(chartPosition * parsed.maxTick)

  const handleExport = () => {
    const fileBase = chartFileName.replace(/\.chart$/i, "")
    downloadEquationBindings(`${fileBase}.equations.json`, {
      version: 1,
      chartFileName,
      chartSignature,
      bindings: equationsByEventId,
    })
  }

  const handleImport = async (file: File) => {
    try {
      const raw = await file.text()
      const parsedFile = JSON.parse(raw) as EquationBindingsFile
      if (!parsedFile.bindings || typeof parsedFile.bindings !== "object") return

      if (parsedFile.chartSignature !== chartSignature) {
        console.warn("Equation binding file does not match current chart signature.")
      }

      setEquationsByEventId((prev) => ({
        ...prev,
        ...parsedFile.bindings,
      }))
    } catch (error) {
      console.error("Failed to import equation bindings", error)
    }
  }

  const handleTypeChange = (nextType: ChartEventType) => {
    if (!currentEvent) return

    const nextChartText = updateChartEventType(chartText, currentEvent, nextType)
    if (nextChartText !== chartText) {
      onChartTextChange?.(nextChartText)
    }
  }

  return (
    <div style={{ borderRadius: "24px", border: "1px solid #334155", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", background: "#111827", color: "#FFFFFF" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#FFFFFF" }}>
          Timeline Panel
        </h2>
        <p style={{ marginTop: "8px", marginBottom: 0, fontSize: "14px", color: "#cbd5e1" }}>
          Use the left palette to replace equation values, and the right palette to change the current event type.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 220px",
          gap: "16px",
          alignItems: "stretch",
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
        }}
      >
        <EquationBlockPalette />

        <div style={{ width: "100%", minHeight: "280px", background: "#1f2937", borderRadius: "20px", padding: "16px" }}>
          {currentEvent && currentEquation ? (
            <EventEquationEditor
              value={currentEquation}
              onChange={(nextEquation) => {
                setEquationsByEventId((prev) => ({
                  ...prev,
                  [currentEvent.id]: nextEquation,
                }))
              }}
            />
          ) : (
            <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#cbd5e1" }}>
              No event is currently available at this chart position.
            </div>
          )}
        </div>

        <EventTypePalette
          currentType={currentEvent?.type ?? null}
          onSelectType={handleTypeChange}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", color: "#FFFFFF", width: "100%", maxWidth: "1440px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!songFile}
          style={{
            borderRadius: "8px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "8px 16px",
            opacity: !songFile ? 0.5 : 1,
            cursor: !songFile ? "not-allowed" : "pointer",
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          onClick={handleExport}
          style={{
            borderRadius: "8px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Export equations
        </button>

        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          style={{
            borderRadius: "8px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Import equations
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImport(file)
            event.currentTarget.value = ""
          }}
        />

        <div style={{ fontSize: "14px", color: "#e5e7eb", minWidth: "120px" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div style={{ fontSize: "14px", color: "#cbd5e1" }}>
          Chart tick: {estimatedChartTick}
        </div>

        <div style={{ fontSize: "14px", color: "#cbd5e1" }}>
          Parsed events: {parsed.events.length}
        </div>

        <div style={{ fontSize: "14px", color: "#cbd5e1" }}>
          Current event: {currentEvent ? currentEvent.label : "None"}
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          borderRadius: "12px",
          border: "1px solid #334155",
          padding: "10px 12px",
          background: timelineGradient,
        }}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          disabled={!songFile}
          style={{
            width: "100%",
            margin: 0,
            background: "transparent",
            accentColor: "#ffffff",
            display: "block",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "1440px", margin: "0 auto" }}>
        <HorizontalDotPanel title="Hits" events={nearbyHits} dotClassName="bg-purple-600" />
        <HorizontalDotPanel title="Drags" events={nearbyDrags} dotClassName="bg-red-600" />
        <HorizontalDotPanel title="Spins" events={nearbySpins} dotClassName="bg-gray-400" />
      </div>

      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      ) : null}
    </div>
  )
}