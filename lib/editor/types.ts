export type Difficulty = "expert" | "hard" | "medium" | "easy"

export type GameplayBlockType =
  | "obstacle"
  | "jump"
  | "hold"
  | "boost"
  | "enemy"
  | "camera"
  | "effect"
  | "trigger"

export type ChartProject = {
  sourceChart?: string
  version: number
  song: SongMetadata
  timing: TimingMetadata
  notes: ChartNote[]
  blocks: GameplayBlock[]
  events: ChartEvent[]
  difficulties: DifficultyMap
  ui?: EditorUiState
  metadata: ProjectMetadata
}

export type SongMetadata = {
  title: string
  artist: string
  audioUrl: string
  audioFilename: string
  durationSeconds: number
}

export type TimingMetadata = {
  bpm: number
  resolution: number
  offsetMs: number
  timeSignatureNumerator: number
  timeSignatureDenominator: number
}

export type ChartNote = {
  id: string
  tick: number
  lane: 0 | 1 | 2 | 3 | 4
  length: number
  source: "generated-vocal" | "generated-percussion" | "manual"
  difficulty: Difficulty
  confidence?: number
}

export type GameplayBlock = {
  id: string
  type: GameplayBlockType
  startTick: number
  endTick?: number
  lane?: number
  label?: string
  params: Record<string, string | number | boolean>
}

export type ChartEvent = {
  id: string
  tick: number
  eventType: string
  value: string
}

export type DifficultyDefinition = {
  noteIds: string[]
  blockIds: string[]
}

export type DifficultyMap = {
  expert: DifficultyDefinition
  hard: DifficultyDefinition
  medium: DifficultyDefinition
  easy: DifficultyDefinition
}

export type SnapSubdivision = 1 | 2 | 4 | 8 | 16
export type SnapMode = "nearest" | "floor" | "ceil"

export type EditorUiState = {
  zoom: number
  snapSubdivision: SnapSubdivision
  selectedIds: string[]
  playheadTick: number
}

export type ProjectMetadata = {
  createdAt: string
  updatedAt: string
  source: "generated" | "edited"
}

export type CombinedAnalysisResponse = {
  song_title?: string
  artist?: string
  bpm: number
  duration_seconds: number
  chart_file?: string
  vocal_analysis?: {
    syllables?: Array<{
      start: number
      end?: number
      confidence?: number
    }>
  }
  percussion_analysis?: {
    drum_hits?: Array<{
      time: number
      confidence?: number
      type?: string
    }>
  }
}

export type UnityPreviewPayload = {
  bpm: number
  resolution: number
  durationSeconds: number
  notes: Array<{
    tick: number
    lane: number
    length: number
  }>
  blocks: Array<{
    id: string
    type: string
    startTick: number
    endTick?: number
    lane?: number
    params: Record<string, string | number | boolean>
  }>
  events: Array<{
    tick: number
    eventType: string
    value: string
  }>
}
