"use client"

import { useEffect, useRef, useState } from "react"
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
  const [localChartText, setLocalChartText] = useState(chartFile)
  const [unityEnabled, setUnityEnabled] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const launchedChartRef = useRef("")

  useEffect(() => {
    if (chartFile && chartFile.trim()) {
      setLocalChartText(chartFile)
    }
  }, [chartFile])

  const handleStart = () => {
    if (!localChartText.trim()) {
      console.warn("[EditorShell] Cannot start preview: chart text is empty")
      return
    }

    if (launchedChartRef.current === localChartText && unityEnabled) {
      console.log("[EditorShell] Preview already started for this chart version")
      return
    }

    setUnityEnabled(true)
    setPendingStart(true)
  }

  useEffect(() => {
    if (!project) return
    if (!unityEnabled) return
    if (!pendingStart) return
    if (!localChartText.trim()) return

    const timeout = window.setTimeout(() => {
      console.log("[EditorShell] Sending chart to Unity")
      const loaded = loadUnityChart(localChartText)

      if (!loaded) {
        console.warn("[EditorShell] Unity is not ready yet")
        return
      }

      console.log("[EditorShell] Starting Unity editor preview")
      const started = startUnityEditorPreview()

      if (!started) {
        console.warn("[EditorShell] Unity preview start message was not delivered")
        return
      }

      launchedChartRef.current = localChartText
      setPendingStart(false)
    }, 600)

    return () => window.clearTimeout(timeout)
  }, [project, unityEnabled, pendingStart, localChartText])

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-2 space-y-4">
          <SongLoader
            onChartTextReady={(text) => {
              setLocalChartText(text)
              launchedChartRef.current = ""
            }}
            onSongFileSelected={async (file) => {
              // Replace this with your real analyzer call.
              // It should return the generated chart text as a string.
              throw new Error(
                `Song analysis is not wired yet for ${file.name}. Connect this to your analyzer endpoint.`
              )
            }}
          />
          <BlockPalette />
        </div>

        <div className="col-span-8 space-y-4">
          <div className="rounded-2xl border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Lesson Builder</h1>
              <p className="text-sm text-gray-500">
                Upload a song or .chart file, then click Start to load the algebra level.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={!localChartText || !localChartText.trim()}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Start
            </button>
          </div>

          <UnityPreview enabled={unityEnabled} />

          <Timeline />
        </div>

        <div className="col-span-2 space-y-4">
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}
