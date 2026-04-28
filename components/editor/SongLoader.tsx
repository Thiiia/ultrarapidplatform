"use client"

import { ChangeEvent, useRef, useState } from "react"

type SongLoaderProps = {
  onChartTextReady?: (chartText: string) => void
  onSongFileSelected?: (file: File) => Promise<string>
}

export function SongLoader({
  onChartTextReady,
  onSongFileSelected,
}: SongLoaderProps) {
  const chartInputRef = useRef<HTMLInputElement | null>(null)
  const songInputRef = useRef<HTMLInputElement | null>(null)

  const [status, setStatus] = useState<string>("No file loaded yet.")
  const [isProcessingSong, setIsProcessingSong] = useState(false)

  const handleChartClick = () => {
    chartInputRef.current?.click()
  }

  const handleSongClick = () => {
    songInputRef.current?.click()
  }

  const handleChartFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()

      if (!text.trim()) {
        setStatus("The selected .chart file was empty.")
        return
      }

      onChartTextReady?.(text)
      setStatus(`Loaded chart file: ${file.name}`)
    } catch (error) {
      console.error("Failed to read .chart file", error)
      setStatus("Failed to read the .chart file.")
    } finally {
      event.target.value = ""
    }
  }

  const handleSongFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!onSongFileSelected) {
      setStatus("Song upload is wired, but no song analysis handler was provided yet.")
      event.target.value = ""
      return
    }

    try {
      setIsProcessingSong(true)
      setStatus(`Analyzing song: ${file.name}...`)

      const chartText = await onSongFileSelected(file)

      if (!chartText || !chartText.trim()) {
        setStatus("Song analysis completed, but no chart text was returned.")
        return
      }

      onChartTextReady?.(chartText)
      setStatus(`Analyzed song and generated chart: ${file.name}`)
    } catch (error) {
      console.error("Failed to analyze uploaded song", error)
      setStatus("Failed to analyze the uploaded song.")
    } finally {
      setIsProcessingSong(false)
      event.target.value = ""
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Song Loader</h2>
        <p className="text-sm text-gray-500">
          Upload a song to generate a chart, or upload a .chart file directly.
        </p>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={handleSongClick}
          disabled={isProcessingSong}
          className="rounded border px-4 py-2 text-left disabled:opacity-50"
        >
          {isProcessingSong ? "Processing song..." : "Upload song"}
        </button>

        <button
          type="button"
          onClick={handleChartClick}
          className="rounded border px-4 py-2 text-left"
        >
          Upload .chart file
        </button>
      </div>

      <div className="rounded-xl bg-black/5 p-3 text-sm text-gray-600">
        {status}
      </div>

      <input
        ref={songInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleSongFileChange}
      />

      <input
        ref={chartInputRef}
        type="file"
        accept=".chart,text/plain"
        className="hidden"
        onChange={handleChartFileChange}
      />
    </div>
  )
}
