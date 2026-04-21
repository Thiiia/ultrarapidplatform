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
  startUnityEditorPreview,
} from "@/lib/editor/unity-bridge"

type EditorShellProps = {
  chartFile?: string
}

export function EditorShell({ chartFile = "" }: EditorShellProps) {
  const project = useEditorStore((s) => s.project)
  const lastStartedChartRef = useRef<string>("")

  useEffect(() => {
    if (!project) return
    if (!chartFile || !chartFile.trim()) return

    const timeout = window.setTimeout(() => {
      console.log("[EditorShell] Sending chart to Unity")
      const chartLoaded = loadUnityChart(chartFile)

      if (!chartLoaded) {
        console.warn("[EditorShell] Unity is not ready yet")
        return
      }

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