import { CombinedAnalysisResponse } from "./types"

export async function mockCombinedAnalysis(file: File): Promise<CombinedAnalysisResponse> {
  await new Promise((resolve) => setTimeout(resolve, 700))

  return {
    song_title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Unknown Artist",
    bpm: 128,
    duration_seconds: 120,
    vocal_analysis: {
      syllables: Array.from({ length: 24 }).map((_, i) => ({
        start: i * 0.5,
        end: i * 0.5 + 0.1,
        confidence: 0.9,
      })),
    },
    percussion_analysis: {
      drum_hits: Array.from({ length: 48 }).map((_, i) => ({
        time: i * 0.25,
        type: i % 4 === 0 ? "kick" : i % 4 === 2 ? "snare" : "hihat",
        confidence: 0.95,
      })),
    },
    chart_file: "",
  }
}