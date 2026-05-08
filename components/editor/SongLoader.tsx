"use client"

import { ChangeEvent, useRef, useState } from "react"

type ChartSourceFormat = "chart" | "mid" | "eof"
type BlankDifficultySection =
  | "EasySingle"
  | "MediumSingle"
  | "HardSingle"
  | "ExpertSingle"

type SongLoaderProps = {
  onSongFileReady: (file: File) => void
  onChartTextReady: (payload: {
    text: string
    fileName: string
    sourceFormat: ChartSourceFormat
    warnings?: string[]
  }) => void
}

type ConvertChartResponse = {
  chartText: string
  fileName: string
  sourceFormat: ChartSourceFormat
  warnings?: string[]
}

type ConvertChartErrorResponse = {
  error?: string
}

function getChartSourceFormat(fileName: string): ChartSourceFormat | null {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".chart")) return "chart"
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) return "mid"
  if (lower.endsWith(".eof")) return "eof"

  return null
}

function isConvertChartResponse(
  payload: ConvertChartResponse | ConvertChartErrorResponse
): payload is ConvertChartResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "chartText" in payload &&
    "fileName" in payload &&
    "sourceFormat" in payload
  )
}

function createBlankChartText(options: {
  songFileName?: string
  bpm: number
  difficultySection: BlankDifficultySection
}) {
  const safeBpm = Math.max(1, Math.round(options.bpm))
  const bpmValue = safeBpm * 1000
  const musicStream = options.songFileName || "song.ogg"

  return `[Song]
{
  Name = "New Song"
  Artist = "Unknown Artist"
  Charter = "UltraRapid"
  Album = "Unknown Album"
  Year = "2025"
  Offset = 0
  Resolution = 192
  Player2 = bass
  Difficulty = 0
  PreviewStart = 0
  PreviewEnd = 0
  Genre = "Unknown"
  MediaType = "cd"
  MusicStream = "${musicStream}"
}

[SyncTrack]
{
  0 = B ${bpmValue}
}

[Events]
{
}

[${options.difficultySection}]
{
}
`
}

export function SongLoader({
  onSongFileReady,
  onChartTextReady,
}: SongLoaderProps) {
  const songInputRef = useRef<HTMLInputElement | null>(null)
  const chartInputRef = useRef<HTMLInputElement | null>(null)

  const [songName, setSongName] = useState("")
  const [chartName, setChartName] = useState("")
  const [status, setStatus] = useState(
    "Upload a song file, upload a chart source, or create a blank chart."
  )
  const [isConverting, setIsConverting] = useState(false)
  const [blankBpm, setBlankBpm] = useState(120)
  const [blankDifficultySection, setBlankDifficultySection] =
    useState<BlankDifficultySection>("ExpertSingle")

  const handleSongButtonClick = () => {
    songInputRef.current?.click()
  }

  const handleChartButtonClick = () => {
    chartInputRef.current?.click()
  }

  const handleCreateBlankChart = () => {
    const fileName = "blank.chart"
    const text = createBlankChartText({
      songFileName: songName || undefined,
      bpm: blankBpm,
      difficultySection: blankDifficultySection,
    })

    setChartName(fileName)
    onChartTextReady({
      text,
      fileName,
      sourceFormat: "chart",
    })

    setStatus(
      songName
        ? `Created "${fileName}" at ${blankBpm} BPM using ${blankDifficultySection}, linked to "${songName}".`
        : `Created blank chart "${fileName}" at ${blankBpm} BPM using ${blankDifficultySection}. Now upload a song file if needed.`
    )
  }

  const handleSongChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const lower = file.name.toLowerCase()
    if (!lower.endsWith(".mp3") && !lower.endsWith(".ogg")) {
      setStatus("Please upload an .mp3 or .ogg file.")
      event.target.value = ""
      return
    }

    setSongName(file.name)
    onSongFileReady(file)
    setStatus(
      chartName
        ? `Loaded song "${file.name}" and chart "${chartName}".`
        : `Loaded song "${file.name}". Now upload a .chart, .mid, .midi, or .eof file, or create a blank chart.`
    )

    event.target.value = ""
  }

  const handleChartChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const sourceFormat = getChartSourceFormat(file.name)
    if (!sourceFormat) {
      setStatus("Please upload a .chart, .mid, .midi, or .eof file.")
      event.target.value = ""
      return
    }

    try {
      setIsConverting(true)
      setStatus(`Loading "${file.name}"...`)

      if (sourceFormat === "chart") {
        const text = await file.text()

        if (!text.trim()) {
          setStatus(`The chart file "${file.name}" was empty.`)
          event.target.value = ""
          return
        }

        setChartName(file.name)
        onChartTextReady({
          text,
          fileName: file.name,
          sourceFormat: "chart",
        })

        setStatus(
          songName
            ? `Loaded song "${songName}" and chart "${file.name}".`
            : `Loaded chart "${file.name}". Now upload a song file.`
        )

        event.target.value = ""
        return
      }

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/chart/convert", {
        method: "POST",
        body: formData,
      })

      const payload: ConvertChartResponse | ConvertChartErrorResponse =
        await response.json()

      if (!response.ok || !isConvertChartResponse(payload)) {
        const message =
          !isConvertChartResponse(payload) && payload.error
            ? payload.error
            : "Failed to convert chart source."
        throw new Error(message)
      }

      setChartName(payload.fileName)
      onChartTextReady({
        text: payload.chartText,
        fileName: payload.fileName,
        sourceFormat: payload.sourceFormat,
        warnings: payload.warnings,
      })

      if (payload.warnings?.length) {
        setStatus(payload.warnings.join(" "))
      } else {
        setStatus(
          songName
            ? `Loaded song "${songName}" and converted "${file.name}" to .chart.`
            : `Converted "${file.name}" to .chart. Now upload a song file.`
        )
      }
    } catch (error) {
      console.error("Failed to load chart source", error)
      const message =
        error instanceof Error ? error.message : "Failed to load chart source."
      setStatus(message)
    } finally {
      setIsConverting(false)
      event.target.value = ""
    }
  }

  return (
    <div
      style={{
        borderRadius: "20px",
        border: "1px solid #334155",
        background: "#111827",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        color: "#FFFFFF",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          Song Loader
        </h2>
        <p
          style={{
            marginTop: "6px",
            marginBottom: 0,
            fontSize: "13px",
            color: "#cbd5e1",
          }}
        >
          Upload an .mp3 or .ogg song, upload a .chart/.mid/.midi/.eof chart
          source, or create a blank .chart.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={handleSongButtonClick}
          style={{
            borderRadius: "10px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "10px 12px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          Upload song (.mp3 / .ogg)
        </button>

        <button
          type="button"
          onClick={handleChartButtonClick}
          disabled={isConverting}
          style={{
            borderRadius: "10px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "10px 12px",
            textAlign: "left",
            cursor: isConverting ? "not-allowed" : "pointer",
            opacity: isConverting ? 0.6 : 1,
          }}
        >
          {isConverting
            ? "Converting chart source..."
            : "Upload chart (.chart / .mid / .midi / .eof)"}
        </button>
      </div>

      <div
        style={{
          borderRadius: "14px",
          border: "1px solid #334155",
          background: "#0f172a",
          padding: "12px",
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          Create blank .chart
        </div>

        <label
          style={{
            display: "grid",
            gap: "6px",
            fontSize: "12px",
            color: "#cbd5e1",
          }}
        >
          BPM
          <input
            type="number"
            min={1}
            value={blankBpm}
            onChange={(e) => setBlankBpm(Math.max(1, Number(e.target.value) || 1))}
            style={{
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#111827",
              color: "#FFFFFF",
              padding: "8px 10px",
            }}
          />
        </label>

        <label
          style={{
            display: "grid",
            gap: "6px",
            fontSize: "12px",
            color: "#cbd5e1",
          }}
        >
          Difficulty section
          <select
            value={blankDifficultySection}
            onChange={(e) =>
              setBlankDifficultySection(e.target.value as BlankDifficultySection)
            }
            style={{
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#111827",
              color: "#FFFFFF",
              padding: "8px 10px",
            }}
          >
            <option value="EasySingle">EasySingle</option>
            <option value="MediumSingle">MediumSingle</option>
            <option value="HardSingle">HardSingle</option>
            <option value="ExpertSingle">ExpertSingle</option>
          </select>
        </label>

        <div
          style={{
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          MusicStream will use the uploaded song filename when available.
        </div>

        <button
          type="button"
          onClick={handleCreateBlankChart}
          disabled={isConverting}
          style={{
            borderRadius: "10px",
            border: "1px solid #475569",
            background: "#1f2937",
            color: "#FFFFFF",
            padding: "10px 12px",
            textAlign: "left",
            cursor: isConverting ? "not-allowed" : "pointer",
            opacity: isConverting ? 0.6 : 1,
          }}
        >
          Create blank .chart
        </button>
      </div>

      <div
        style={{
          borderRadius: "14px",
          background: "#0f172a",
          border: "1px solid #334155",
          padding: "12px",
          fontSize: "13px",
          color: "#e5e7eb",
          display: "grid",
          gap: "6px",
        }}
      >
        <div>
          <span style={{ fontWeight: 600 }}>Song:</span>{" "}
          {songName || "Not uploaded yet"}
        </div>
        <div>
          <span style={{ fontWeight: 600 }}>Chart source:</span>{" "}
          {chartName || "Not uploaded yet"}
        </div>
        <div style={{ paddingTop: "6px", color: "#cbd5e1" }}>{status}</div>
      </div>

      <input
        ref={songInputRef}
        type="file"
        accept=".mp3,.ogg,audio/mpeg,audio/ogg"
        style={{ display: "none" }}
        onChange={handleSongChange}
      />

      <input
        ref={chartInputRef}
        type="file"
        accept=".chart,.mid,.midi,.eof"
        style={{ display: "none" }}
        onChange={handleChartChange}
      />
    </div>
  )
}