"use client"

import { useEffect, useState } from "react"
import { EditorShell } from "@/components/editor/EditorShell"
import { useEditorStore } from "@/lib/editor/editor-store"
import { chartToProject } from "@/lib/editor/chart-to-project"

type EditorRedirectPayload = {
  chartFile: string
  analysisMetadata?: {
    songTitle?: string
    artist?: string
    bpm?: number
    durationSeconds?: number
    uploadedFileName?: string
  }
  rawResults?: any
}

export default function EditorPage() {
  const setProject = useEditorStore((s) => s.setProject)
  const [chartFile, setChartFile] = useState("")

  useEffect(() => {
    const raw = sessionStorage.getItem("ultrarapid_editor_payload")
    if (!raw) return

    try {
      const payload: EditorRedirectPayload = JSON.parse(raw)

      if (payload?.chartFile) {
        setChartFile(payload.chartFile)
        const project = chartToProject(payload)
        setProject(project)
      }

      sessionStorage.removeItem("ultrarapid_editor_payload")
    } catch (error) {
      console.error("Failed to hydrate editor payload", error)
    }
  }, [setProject])

  return <EditorShell chartFile={chartFile} />
}