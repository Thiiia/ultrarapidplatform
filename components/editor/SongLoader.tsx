"use client"

import { ChangeEvent, useRef, useState } from "react"

type SongLoaderProps = {
  onSongFileReady: (file: File) => void
  onChartTextReady: (text: string, fileName: string) => void
}

export function SongLoader({
  onSongFileReady,
  onChartTextReady,
}: SongLoaderProps) {
  const songInputRef = useRef<HTMLInputElement | null>(null)
  const chartInputRef = useRef<HTMLInputElement | null>(null)

  const [songName, setSongName] = useState("")
  const [chartName, setChartName] = useState("")
  const [status, setStatus] = useState("Upload a song file and a .chart file.")

  const handleSongButtonClick = () => {
    songInputRef.current?.click()
  }

  const handleChartButtonClick = () => {
    chartInputRef.current?.click()
  }

  const handleSongChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSongName(file.name)
    onSongFileReady(file)
    setStatus(chartName
      ? `Loaded song "${file.name}" and chart "${chartName}".`
      : `Loaded song "${file.name}". Now upload a .chart file.`)

    event.target.value = ""
  }

  const handleChartChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()

      if (!text.trim()) {
        setStatus(`The chart file "${file.name}" was empty.`)
        event.target.value = ""
        return
      }

      setChartName(file.name)
      onChartTextReady(text, file.name)
      setStatus(songName
        ? `Loaded song "${songName}" and chart "${file.name}".`
        : `Loaded chart "${file.name}". Now upload a song file.`)
    } catch (error) {
      console.error("Failed to read chart file", error)
      setStatus(`Failed to read chart file "${file.name}".`)
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Song Loader</h2>
        <p className="text-sm text-gray-500">
          Upload one song file and one .chart file for the editor.
        </p>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={handleSongButtonClick}
          className="rounded border px-4 py-2 text-left"
        >
          Upload song file
        </button>

        <button
          type="button"
          onClick={handleChartButtonClick}
          className="rounded border px-4 py-2 text-left"
        >
          Upload .chart file
        </button>
      </div>

      <div className="rounded-xl bg-black/5 p-3 text-sm text-gray-700 space-y-1">
        <div>
          <span className="font-medium">Song:</span>{" "}
          {songName || "Not uploaded yet"}
        </div>
        <div>
          <span className="font-medium">Chart:</span>{" "}
          {chartName || "Not uploaded yet"}
        </div>
        <div className="pt-2 text-gray-500">{status}</div>
      </div>

      <input
        ref={songInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleSongChange}
      />

      <input
        ref={chartInputRef}
        type="file"
        accept=".chart,text/plain"
        className="hidden"
        onChange={handleChartChange}
      />
    </div>
  )
}