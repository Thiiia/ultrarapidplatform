import { nanoid } from "nanoid"
import { ChartNote, ChartProject } from "./types"

type EditorRedirectPayload = {
  chartFile: string
  analysisMetadata?: {
    songTitle?: string
    artist?: string
    bpm?: number
    durationSeconds?: number
    uploadedFileName?: string
  }
  rawResults?: unknown
}

function emptyDifficulty() {
  return { noteIds: [], blockIds: [] }
}

function parseResolution(chartText: string) {
  const match = chartText.match(/Resolution\s*=\s*"?(\d+)"?/)
  return match ? Number(match[1]) : 240
}

function parseSongName(chartText: string) {
  const match = chartText.match(/Name\s*=\s*"([^"]+)"/)
  return match ? match[1] : "Untitled Song"
}

function parseArtist(chartText: string) {
  const match = chartText.match(/Artist\s*=\s*"([^"]+)"/)
  return match ? match[1] : "Unknown Artist"
}

function parseBpm(chartText: string) {
  const match = chartText.match(/\[SyncTrack\][\s\S]*?0\s*=\s*B\s*(\d+)/)
  return match ? Number(match[1]) / 1000 : 120
}

function parseExpertSection(chartText: string) {
  const match = chartText.match(/\[ExpertSingle\]\s*\{([\s\S]*?)\}/)
  return match ? match[1] : ""
}

function parseEventsSection(chartText: string) {
  const match = chartText.match(/\[Events\]\s*\{([\s\S]*?)\}/)
  return match ? match[1] : ""
}

function unescapeChartString(value: string) {
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
}

function parseEvents(eventsSection: string): ChartProject["events"] {
  const lines = eventsSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const events: ChartProject["events"] = []

  for (const line of lines) {
    const eventMatch = line.match(/^(\d+)\s*=\s*E\s+"([\s\S]*)"$/)
    if (!eventMatch) continue

    const tick = Number(eventMatch[1])
    const payload = eventMatch[2]
    const unescapedPayload = unescapeChartString(payload)
    const separatorIndex = unescapedPayload.indexOf(":")
    const eventType =
      separatorIndex >= 0
        ? unescapedPayload.slice(0, separatorIndex)
        : unescapedPayload
    const value =
      separatorIndex >= 0
        ? unescapedPayload.slice(separatorIndex + 1)
        : ""

    events.push({
      id: nanoid(),
      tick,
      eventType,
      value,
    })
  }

  return events.sort((a, b) => a.tick - b.tick || a.eventType.localeCompare(b.eventType))
}

function parseNotes(expertSection: string): ChartNote[] {
  const lines = expertSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const notes: ChartNote[] = []

  for (const line of lines) {
    const noteMatch = line.match(/^(\d+)\s*=\s*N\s+(\d+)\s+(\d+)/)
    if (!noteMatch) continue

    const tick = Number(noteMatch[1])
    const lane = Number(noteMatch[2]) as 0 | 1 | 2 | 3 | 4
    const length = Number(noteMatch[3])

    if (lane < 0 || lane > 4) continue

    notes.push({
      id: nanoid(),
      tick,
      lane,
      length,
      source: "manual",
      difficulty: "expert",
    })
  }

  return notes.sort((a, b) => a.tick - b.tick || a.lane - b.lane)
}

export function chartToProject(payload: EditorRedirectPayload): ChartProject {
  const chartText = payload.chartFile || ""
  const resolution = parseResolution(chartText)
  const bpm = payload.analysisMetadata?.bpm || parseBpm(chartText)
  const title = payload.analysisMetadata?.songTitle || parseSongName(chartText)
  const artist = payload.analysisMetadata?.artist || parseArtist(chartText)
  const durationSeconds = payload.analysisMetadata?.durationSeconds || 0
  const audioFilename = payload.analysisMetadata?.uploadedFileName || "audio.mp3"

  const notes = parseNotes(parseExpertSection(chartText))
  const events = parseEvents(parseEventsSection(chartText))
  const now = new Date().toISOString()

  return {
    version: 1,
    song: {
      title,
      artist,
      audioUrl: `/uploads/${audioFilename}`,
      audioFilename,
      durationSeconds,
    },
    timing: {
      bpm,
      resolution,
      offsetMs: 0,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    },
    notes,
    blocks: [],
    events,
    difficulties: {
      expert: { noteIds: notes.map((n) => n.id), blockIds: [] },
      hard: emptyDifficulty(),
      medium: emptyDifficulty(),
      easy: emptyDifficulty(),
    },
    ui: {
      zoom: 1,
      snapSubdivision: 4,
      selectedIds: [],
      playheadTick: 0,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      source: "generated",
    },
  }
}