"use client"

import { useEffect, useState } from "react"
import { SongLoader } from "./SongLoader"
import { InspectorPanel } from "./InspectorPanel"
import { BrowserTimelinePanel } from "./BrowserTimelinePanel"
import { Timeline } from "./Timeline"
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
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#FFFFFF",
        padding: "24px",
      }}
    >
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-2 space-y-4">
          <SongLoader
            onSongFileReady={(file) => {
              setSongFile(file)
            }}
            onChartTextReady={({ text, fileName }) => {
              setChartText(text)
              setChartFileName(fileName)
            }}
          />
        </div>

        <div className="col-span-8 space-y-4">
          <div
            style={{
              borderRadius: "24px",
              border: "1px solid #334155",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#111827",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#FFFFFF" }}>
                Lesson Builder
              </h1>
              <p style={{ marginTop: "8px", marginBottom: 0, fontSize: "14px", color: "#cbd5e1" }}>
                Upload a song and a chart source, normalize to .chart, and edit events in the browser.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowChart((prev) => !prev)}
              disabled={!chartText.trim()}
              style={{
                borderRadius: "8px",
                border: "1px solid #475569",
                background: "#1f2937",
                color: "#FFFFFF",
                padding: "8px 16px",
                opacity: !chartText.trim() ? 0.5 : 1,
                cursor: !chartText.trim() ? "not-allowed" : "pointer",
              }}
            >
              {showChart ? "Hide .chart" : "View .chart"}
            </button>
          </div>

          <BrowserTimelinePanel
            songFile={songFile}
            chartText={chartText}
            chartFileName={chartFileName || "chart.chart"}
            onChartTextChange={setChartText}
          />

          {showChart && (
            <div
              style={{
                borderRadius: "24px",
                border: "1px solid #334155",
                padding: "16px",
                background: "#111827",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
                Current .chart File
              </h2>
              <div
                style={{
                  marginTop: "12px",
                  borderRadius: "16px",
                  background: "#020617",
                  color: "#86efac",
                  padding: "16px",
                  overflow: "auto",
                  maxHeight: "24rem",
                  fontSize: "12px",
                  whiteSpace: "pre-wrap",
                  border: "1px solid #334155",
                }}
              >
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