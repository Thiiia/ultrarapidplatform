"use client"

import { useEffect, useRef } from "react"
import { SongLoader } from "./SongLoader"
import { BlockPalette } from "./BlockPalette"
import { Timeline } from "./Timeline"
import { InspectorPanel } from "./InspectorPanel"
import { UnityPreview } from "./UnityPreview"
import { useEditorStore } from "@/lib/editor/editor-store"
import {
  loadUnityChart,
  loadUnityPreview,
  startUnityEditorPreview,
} from "@/lib/editor/unity-bridge"
import { projectToUnityPreview } from "@/lib/editor/project-to-unity-preview"

type EditorShellProps = {
  chartFile?: string
}

export function EditorShell({ chartFile = "" }: EditorShellProps) {
  const project = useEditorStore((s) => s.project)
  const lastStartedChartRef = useRef<string>("")

  useEffect(() => {
    if (!project) return
    if (!chartFile) return

    const timeout = window.setTimeout(() => {
      const previewPayload = projectToUnityPreview(project)

      console.log("[EditorShell] Sending chart to Unity")
      loadUnityChart(chartFile)

      console.log("[EditorShell] Sending preview payload to Unity")
      loadUnityPreview(previewPayload)

      if (lastStartedChartRef.current !== chartFile) {
        console.log("[EditorShell] Starting Unity editor preview")
        startUnityEditorPreview()
        lastStartedChartRef.current = chartFile
      }
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [project, chartFile])

  return (
    <div className="grid grid-cols-12 gap-4 p-6">
      <div className="col-span-3 space-y-4">
        <SongLoader />
        <BlockPalette />
        <InspectorPanel />
      </div>

      <div className="col-span-6 space-y-4">
        <Timeline />
      </div>

      <div className="col-span-3 space-y-4">
        <UnityPreview />
      </div>
    </div>
  )
}