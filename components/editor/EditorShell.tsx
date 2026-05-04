"use client"

import { useEffect, useState } from "react"
import { SongLoader } from "./SongLoader"
import { BlockPalette } from "./BlockPalette"
import { Timeline } from "./Timeline"
import { InspectorPanel } from "./InspectorPanel"
import { BrowserTimelinePanel } from "./BrowserTimelinePanel"
import { useEditorStore } from "@/lib/editor/editor-store"

type EditorShellProps = {
  chartFile?: string
}

export function EditorShell({ chartFile = "" }: EditorShellProps) {
  const project = useEditorStore((s) => s.project)

  const [songFile, setSongFile] = useState<File | null>(null)
  const [chartText, setChartText] = useState(chartFile)
  const [chartFileName, setChartFileName] = useState("")
  const [showChart, setShowChart] = useState(false)

  useEffect(() => {
    if (chartFile && chartFile.trim()) {
      setChartText(chartFile)
      if (!chartFileName) {
        setChartFileName("generated.chart")
      }
    }
  }, [chartFile, chartFileName])

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-2 space-y-4">
          <SongLoader
            onSongFileReady={(file) => {
              setSongFile(file)
            }}
            onChartTextReady={(text, fileName) => {
              setChartText(text)
              setChartFileName(fileName)
            }}
          />
          <BlockPalette />
        </div>

        <div className="col-span-8 space-y-4">
          <div className="rounded-2xl border p-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Lesson Builder</h1>
              <p className="text-sm text-gray-500">
                Upload a song file and a .chart file to build and inspect the lesson in the browser.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowChart((prev) => !prev)}
              disabled={!chartText.trim()}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              {showChart ? "Hide .chart" : "View .chart"}
            </button>
          </div>

          <div className="rounded-2xl border p-4 space-y-3">
            <h2 className="text-lg font-semibold">Editor Window</h2>
            <p className="text-sm text-gray-500">
              Browser-only editor preview area.
            </p>

            <div className="rounded-xl border bg-black/5 p-6 text-sm text-gray-600">
              <div>
                <span className="font-medium">Song:</span>{" "}
                {songFile ? songFile.name : "Not uploaded yet"}
              </div>
              <div>
                <span className="font-medium">Chart:</span>{" "}
                {chartFileName || "Not uploaded yet"}
              </div>
              <div className="pt-3 text-gray-500">
                Use the panel below to play the song and scrub through the chart timeline.
              </div>
            </div>
          </div>

          <BrowserTimelinePanel
            songFile={songFile}
            chartText={chartText}
          />

          {showChart && (
            <div className="rounded-2xl border p-4 space-y-3">
              <h2 className="text-lg font-semibold">Current .chart File</h2>
              <div className="rounded-xl bg-black text-green-300 p-4 overflow-auto max-h-96 text-xs whitespace-pre-wrap">
                {chartText || "No chart file loaded."}
              </div>
            </div>
          )}

          <Timeline />
        </div>

        <div className="col-span-2 space-y-4">
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}