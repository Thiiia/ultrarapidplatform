"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type BrowserTimelinePanelProps = {
  songFile: File | null
  chartText: string
}

type ChartEventType = "hit" | "drag" | "spin"

type ParsedChartEvent = {
  type: ChartEventType
  tick: number
  length: number
  lane?: number
  seconds: number
  label: string
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

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")}`
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
    .map((match) => {
      const tick = Number(match[1])
      const lane = Number(match[2])
      const length = Number(match[3])

      const type: ChartEventType = length > 0 ? "drag" : "hit"

      return {
        type,
        tick,
        lane,
        length,
        seconds: tickToSeconds(tick, resolution, bpmPoints),
        label: type === "drag" ? `Drag lane ${lane}` : `Hit lane ${lane}`,
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
    .sort((a, b) => a.tick - b.tick)

  const hits = noteEvents.filter((event) => event.type === "hit")
  const drags = noteEvents.filter((event) => event.type === "drag")

  // Spins are intentionally empty until you define a custom encoding.
  const spins: ParsedChartEvent[] = []

  const events = [...hits, ...drags].sort((a, b) => a.seconds - b.seconds)
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
  return events.filter(
    (event) => Math.abs(event.seconds - currentTime) <= windowSeconds
  )
}

function EventList({
  title,
  events,
}: {
  title: string
  events: ParsedChartEvent[]
}) {
  return (
    <div className="rounded-xl border p-4 bg-white">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">Count: {events.length}</p>

      <div className="mt-3 space-y-2 max-h-40 overflow-auto">
        {events.length === 0 ? (
          <div className="text-sm text-gray-400">No nearby events.</div>
        ) : (
          events.slice(0, 12).map((event, index) => (
            <div
              key={`${title}-${event.tick}-${index}`}
              className="rounded border px-3 py-2 text-sm text-gray-700"
            >
              <div className="font-medium">{event.label}</div>
              <div className="text-xs text-gray-500">
                {formatTime(event.seconds)} • tick {event.tick}
                {typeof event.lane === "number" ? ` • lane ${event.lane}` : ""}
                {event.length > 0 ? ` • len ${event.length}` : ""}
              </div>
            </div>
          ))
        )}
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
    () => getNearbyEvents(parsed.hits, currentTime),
    [parsed.hits, currentTime]
  )

  const nearbyDrags = useMemo(
    () => getNearbyEvents(parsed.drags, currentTime),
    [parsed.drags, currentTime]
  )

  const nearbySpins = useMemo(
    () => getNearbyEvents(parsed.spins, currentTime),
    [parsed.spins, currentTime]
  )

  const chartPosition =
    duration > 0 ? currentTime / duration : 0

  const estimatedChartTick = Math.round(chartPosition * parsed.maxTick)

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Timeline Panel</h2>
        <p className="text-sm text-gray-500">
          The slider plays and seeks the uploaded song. The event panels are populated from parsed .chart events.
        </p>
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
          Parsed events: {parsed.events.length}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        disabled={!songFile}
        className="w-full"
      />

      <div className="grid grid-cols-3 gap-4">
        <EventList title="Hits" events={nearbyHits} />
        <EventList title="Drags" events={nearbyDrags} />
        <EventList title="Spins" events={nearbySpins} />
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