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
  const lastSentChartRef = useRef<string>("")
  const lastLaunchedChartRef = useRef<string>("")

  useEffect(() => {
    if (!project) return
    if (!chartFile || !chartFile.trim()) return

    const timeout = window.setTimeout(() => {
      if (lastSentChartRef.current === chartFile) return

      console.log("[EditorShell] Sending chart to Unity for live preview")
      const sent = loadUnityChart(chartFile)

      if (!sent) {
        console.warn("[EditorShell] Unity is not ready yet")
        return
      }

      lastSentChartRef.current = chartFile
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [project, chartFile])

  const handleLaunchFullPreview = () => {
    if (!chartFile || !chartFile.trim()) {
      console.warn("[EditorShell] Cannot launch preview: chartFile is empty")
      return
    }

    if (lastLaunchedChartRef.current === chartFile) {
      console.log("[EditorShell] Full preview already launched for this chart version")
      return
    }

    console.log("[EditorShell] Launching full Unity preview")
    const sent = startUnityEditorPreview()

    if (!sent) {
      console.warn("[EditorShell] Unity is not ready yet")
      return
    }

    lastLaunchedChartRef.current = chartFile
  }

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-2 space-y-4">
          <SongLoader />
          <BlockPalette />
        </div>

        <div className="col-span-8 space-y-4">
          <div className="rounded-2xl border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Lesson Builder</h1>
              <p className="text-sm text-gray-500">
                Edit the chart and preview the gameplay in the center panel.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLaunchFullPreview}
              disabled={!chartFile || !chartFile.trim()}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Launch Full Preview
            </button>
          </div>

          <UnityPreview />

          <Timeline />
        </div>

        <div className="col-span-2 space-y-4">
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}