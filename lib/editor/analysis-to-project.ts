import { nanoid } from "nanoid"
import { ChartNote, ChartProject, CombinedAnalysisResponse } from "./types"
import { secondsToTicks } from "./snap"

function emptyDifficulty() {
  return { noteIds: [], blockIds: [] }
}

function laneFromDrumType(type?: string): 0 | 1 | 2 | 3 | 4 {
  switch (type) {
    case "kick":
      return 0
    case "snare":
      return 2
    case "hihat":
      return 4
    default:
      return 3
  }
}

export function analysisToProject(
  analysis: CombinedAnalysisResponse,
  audioUrl: string,
  audioFilename: string,
): ChartProject {
  const bpm = analysis.bpm || 120
  const resolution = 240
  const now = new Date().toISOString()

  const vocalNotes: ChartNote[] = (analysis.vocal_analysis?.syllables || []).map((s, index) => {
    const tick = secondsToTicks(s.start, bpm, resolution)
    const lane = (index % 5) as 0 | 1 | 2 | 3 | 4
    const length = s.end ? Math.max(0, secondsToTicks(s.end - s.start, bpm, resolution)) : 0

    return {
      id: nanoid(),
      tick,
      lane,
      length,
      source: "generated-vocal",
      difficulty: "expert",
      confidence: s.confidence,
    }
  })

  const drumNotes: ChartNote[] = (analysis.percussion_analysis?.drum_hits || []).map((hit) => ({
    id: nanoid(),
    tick: secondsToTicks(hit.time, bpm, resolution),
    lane: laneFromDrumType(hit.type),
    length: 0,
    source: "generated-percussion",
    difficulty: "expert",
    confidence: hit.confidence,
  }))

  const notes = [...vocalNotes, ...drumNotes]
    .sort((a, b) => a.tick - b.tick || a.lane - b.lane)
    .filter((note, index, arr) => {
      const prev = arr[index - 1]
      return !prev || prev.tick !== note.tick || prev.lane !== note.lane
    })

  return {
    version: 1,
    song: {
      title: analysis.song_title || audioFilename.replace(/\.[^/.]+$/, ""),
      artist: analysis.artist || "Unknown Artist",
      audioUrl,
      audioFilename,
      durationSeconds: analysis.duration_seconds || 0,
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
    events: [],
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