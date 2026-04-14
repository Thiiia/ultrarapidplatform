import { NextRequest, NextResponse } from "next/server"
import { analysisToProject } from "@/lib/editor/analysis-to-project"
import { mockCombinedAnalysis } from "@/lib/editor/mock-analysis"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const audio = formData.get("audio_file") as File | null

  if (!audio) {
    return NextResponse.json({ error: "audio_file is required" }, { status: 400 })
  }

  const analysis = await mockCombinedAnalysis(audio)
  const project = analysisToProject(analysis, `/uploads/${audio.name}`, audio.name)

  return NextResponse.json({
    project,
    chartFile: analysis.chart_file || "",
  })
}