"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EventEquationEditor, EquationValue } from "./EventEquationEditor"

type BrowserTimelinePanelProps = {
  songFile: File | null
  chartText: string
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
  equation: EquationValue
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

const HIT_COLOR = { r: 147, g: 51, b: 234 }
const DRAG_COLOR = { r: 220, g: 38, b: 38 }
const EMPTY_COLOR = { r: 229, g: 231, b: 235 }

const DEFAULT_EQUATION: EquationValue = {
  leftA: "x",
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
  if (!syncSectionMatch) {
    return [{ tick: 0, bpm: 120 }]
  }

  const section = syncSectionMatch[1]
  const matches = [...section.matchAll(/^\s*(\d+)\s*=\s*B\s+(\d+)/gm)]

  const points: SyncBpmPoint[] = matches
    .map((match) => {
      const tick = Number(match[1])
      const raw = Number(match[2])
      const bpm = raw / 1000
      return { tick, bpm }
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
      const secondsPerBeat = 60 / current.bpm
      totalSeconds += beats * secondsPerBeat
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
    if (match) {
      return match[1]
    }
  }

  return ""
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
        id: `event-${tick}-${lane}-${index}`,
        type,
        tick,
        lane,
        length,
        seconds: tickToSeconds(tick, resolution, bpmPoints),
        label: type === "drag" ? `Drag lane ${laneLabel(lane)}` : `Hit lane ${laneLabel(lane)}`,
        color,
        equation: { ...DEFAULT_EQUATION },
      }
    })
    .filter((event) => {
      return (
        Number.isFinite(event.tick) &&
        Number.isFinite(event.lane) &&
        Number.isFinite(event.length) &&
        Number.isFinite(event.seconds)
      )
    })
    .sort((a, b) => a.seconds - b.seconds)

  const hits = noteEvents.filter((event) => event.type === "hit")
  const drags = noteEvents.filter((event) => event.type === "drag")
  const spins: ParsedChartEvent[] = []

  const events = [...hits, ...drags, ...spins].sort((a, b) => a.seconds - b.seconds)
  const maxTick = events.length ? Math.max(...events.map((event) => event.tick)) : 0

  return {
    resolution,
    events,
    hits,
    drags,
    spins,
    maxTick,
  }
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
  if (!Number.isFinite(duration) || duration <= 0) {
    return []
  }

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

    segments.push({
      startSeconds,
      endSeconds,
      color,
    })
  }

  return segments
}

function buildSegmentGradient(segments: TimelineSegment[], duration: number) {
  if (!segments.length || duration <= 0) {
    return "#e5e7eb"
  }

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
    <div className="rounded-xl border p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">Count: {events.length}</p>
      </div>

      <div className="rounded-lg border bg-black/5 p-3 min-h-[56px]">
        <div className="flex flex-wrap gap-2 items-center">
          {events.length === 0 ? (
            <div className="text-sm text-gray-400">No nearby events.</div>
          ) : (
            events.map((event, index) => (
              <div
                key={`${title}-${event.tick}-${event.lane}-${index}`}
                title={`${event.label} • ${formatTime(event.seconds)} • tick ${event.tick} • lane ${laneLabel(event.lane)}`}
                className={`h-3 w-3 rounded-full ${dotClassName} shrink-0`}
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
}: BrowserTimelinePanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [audioUrl, setAudioUrl] = useState("")
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const parsed = useMemo(() => parseChartData(chartText), [chartText])
  const [editableEvents, setEditableEvents] = useState<ParsedChartEvent[]>([])

  useEffect(() => {
    setEditableEvents(parsed.events)
  }, [parsed])

  const timelineSegments = useMemo(
    () => buildTimelineSegments(editableEvents, duration, 1200, 4),
    [editableEvents, duration]
  )

  const timelineGradient = useMemo(
    () => buildSegmentGradient(timelineSegments, duration),
    [timelineSegments, duration]
  )

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

    if (audio) {
      audio.currentTime = value
    }
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

  const nearbyHits = useMemo(
    () => getNearbyEvents(editableEvents.filter((e) => e.type === "hit"), currentTime),
    [editableEvents, currentTime]
  )

  const nearbyDrags = useMemo(
    () => getNearbyEvents(editableEvents.filter((e) => e.type === "drag"), currentTime),
    [editableEvents, currentTime]
  )

  const nearbySpins = useMemo(
    () => getNearbyEvents(editableEvents.filter((e) => e.type === "spin"), currentTime),
    [editableEvents, currentTime]
  )

  const currentEventIndex = useMemo(
    () => getCurrentEventIndex(editableEvents, currentTime),
    [editableEvents, currentTime]
  )

  const currentEvent = currentEventIndex >= 0 ? editableEvents[currentEventIndex] : null

  const chartPosition = duration > 0 ? currentTime / duration : 0
  const estimatedChartTick = Math.round(chartPosition * parsed.maxTick)

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Timeline Panel</h2>
        <p className="text-sm text-gray-500">
          Each parsed chart event gets an equation. The viewing window is responsive, and circle diameter is tied to 13% of the window width.
        </p>
      </div>

      <div
        className="rounded-2xl border bg-white overflow-hidden mx-auto w-full"
        style={{
          maxWidth: "1400px",
          height: "clamp(620px, 62vw, 880px)",
          ["--equation-circle-size" as string]: "13vw",
        }}
      >
        <div
          className="h-full w-full p-6 md:p-8"
          style={{
            ["--equation-circle-size" as string]: "min(calc(100% * 0.13), 220px)",
          }}
        >
          {currentEvent ? (
            <EventEquationEditor
              value={currentEvent.equation}
              onChange={(nextEquation) => {
                setEditableEvents((prev) =>
                  prev.map((event, index) =>
                    index === currentEventIndex
                      ? { ...event, equation: nextEquation }
                      : event
                  )
                )
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">
              No event is currently available at this chart position.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!songFile}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div className="text-sm text-gray-600 min-w-[120px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div className="text-sm text-gray-500">
          Chart tick: {estimatedChartTick}
        </div>

        <div className="text-sm text-gray-500">
          Parsed events: {editableEvents.length}
        </div>

        <div className="text-sm text-gray-500">
          Current event: {currentEvent ? currentEvent.label : "None"}
        </div>
      </div>

      <div
        className="rounded-lg border p-2"
        style={{ background: timelineGradient }}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          disabled={!songFile}
          className="w-full bg-transparent"
        />
      </div>

      <div className="space-y-4">
        <HorizontalDotPanel
          title="Hits"
          events={nearbyHits}
          dotClassName="bg-purple-600"
        />

        <HorizontalDotPanel
          title="Drags"
          events={nearbyDrags}
          dotClassName="bg-red-600"
        />

        <HorizontalDotPanel
          title="Spins"
          events={nearbySpins}
          dotClassName="bg-gray-400"
        />
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