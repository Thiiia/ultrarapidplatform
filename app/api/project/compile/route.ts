import { NextRequest, NextResponse } from "next/server"
import { projectToChart } from "@/lib/editor/project-to-chart"
import { projectToUnityPreview } from "@/lib/editor/project-to-unity-preview"
import { ChartProject } from "@/lib/editor/types"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const project = body.project as ChartProject

  if (!project) {
    return NextResponse.json({ error: "project is required" }, { status: 400 })
  }

  return NextResponse.json({
    chartFile: projectToChart(project),
    previewPayload: projectToUnityPreview(project),
  })
}