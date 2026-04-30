"use client"

import { useEffect, useRef, useState } from "react"
import { SongLoader } from "./SongLoader"
import { BlockPalette } from "./BlockPalette"
import { Timeline } from "./Timeline"
import { InspectorPanel } from "./InspectorPanel"
import { UnityPreview } from "./UnityPreview"
import { ChartWavePanel } from "./ChartWavePanel"
import { useEditorStore } from "@/lib/editor/editor-store"
import {
  loadUnityChart,
  startUnityEditorPreview,
  setUnityPreviewSeconds,
} from "@/lib/editor/unity-bridge"

type EditorShellProps = {
  chartFile?: string
}

export function EditorShell({ chartFile = "" }: EditorShellProps) {
  const project = useEditorStore((s) => s.project)

  const [songFile, setSongFile] = useState<File | null>(null)
  const [chartText, setChartText] = useState(chartFile)
  const [unityEnabled, setUnityEnabled] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)

  const launchedSignatureRef = useRef("")

  useEffect(() => {
    if (chartFile && chartFile.trim()) {
      setChartText(chartFile)
    }
  }, [chartFile])

  const canStart = Boolean(songFile && chartText.trim())

  const handleStart = () => {
    if (!songFile) {
      console.warn("[EditorShell] Cannot start: no song file uploaded")
      return
    }

    if (!chartText.trim()) {
      console.warn("[EditorShell] Cannot start: no chart text uploaded")
      return
    }

    const signature = `${songFile.name}::${chartText.length}`
    if (unityEnabled && launchedSignatureRef.current === signature) {
      console.log("[EditorShell] Preview already started for this upload set")
      return
    }

    setUnityEnabled(true)
    setPendingStart(true)
  }

  useEffect(() => {
    if (!project) return
    if (!unityEnabled) return
    if (!pendingStart) return
    if (!songFile) return
    if (!chartText.trim()) return

    const signature = `${songFile.name}::${chartText.length}`

    const timeout = window.setTimeout(() => {
      console.log("[EditorShell] Sending chart to Unity")
      const chartLoaded = loadUnityChart(chartText)

      if (!chartLoaded) {
        console.warn("[EditorShell] Unity is not ready yet")
        return
      }

      console.log("[EditorShell] Starting Unity editor preview")
      const started = startUnityEditorPreview()

      if (!started) {
        console.warn("[EditorShell] Failed to send StartEditorPreview")
        return
      }

      launchedSignatureRef.current = signature
      setPendingStart(false)
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [project, unityEnabled, pendingStart, songFile, chartText])

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-2 space-y-4">
          <SongLoader
            onSongFileReady={(file) => {
              setSongFile(file)
            }}
            onChartTextReady={(text) => {
              setChartText(text)
            }}
          />
          <BlockPalette />
        </div>

        <div className="col-span-8 space-y-4">
          <div className="rounded-2xl border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Lesson Builder</h1>
              <p className="text-sm text-gray-500">
                Upload both a song file and a .chart file, then click Start.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Start
            </button>
          </div>

          <UnityPreview enabled={unityEnabled} />

          <ChartWavePanel
            songFile={songFile}
            chartText={chartText}
            disabled={!unityEnabled}
            onScrubSeconds={(seconds) => {
              setUnityPreviewSeconds(seconds)
            }}
          />

          <Timeline />
        </div>

        <div className="col-span-2 space-y-4">
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}