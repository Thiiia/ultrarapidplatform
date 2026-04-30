"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type ChartWavePanelProps = {
  songFile: File | null
  chartText: string
  onScrubSeconds: (seconds: number) => void
  disabled?: boolean
}

type WavePoint = {
  min: number
  max: number
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function parseChartTicks(chartText: string) {
  const noteTicks: number[] = []
  const regex = /^\s*(\d+)\s*=\s*N\s+\d+\s+\d+/gm

  let match: RegExpExecArray | null
  while ((match = regex.exec(chartText)) !== null) {
    const tick = Number(match[1])
    if (Number.isFinite(tick)) noteTicks.push(tick)
  }

  const maxTick = noteTicks.length ? Math.max(...noteTicks) : 0
  return {
    noteTicks,
    maxTick,
  }
}

export function ChartWavePanel({
  songFile,
  chartText,
  onScrubSeconds,
  disabled = false,
}: ChartWavePanelProps) {
  const [showChart, setShowChart] = useState(false)
  const [audioUrl, setAudioUrl] = useState("")
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [waveform, setWaveform] = useState<WavePoint[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { noteTicks, maxTick } = useMemo(() => parseChartTicks(chartText), [chartText])

  useEffect(() => {
    if (!songFile) {
      setAudioUrl("")
      setDuration(0)
      setCurrentTime(0)
      setWaveform([])
      return
    }

    const url = URL.createObjectURL(songFile)
    setAudioUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [songFile])

  useEffect(() => {
    if (!songFile) return

    let cancelled = false

    const buildWaveform = async () => {
      try {
        const buffer = await songFile.arrayBuffer()
        const audioContext = new AudioContext()
        const decoded = await audioContext.decodeAudioData(buffer.slice(0))
        const channelData = decoded.getChannelData(0)

        const samples = 320
        const blockSize = Math.floor(channelData.length / samples)
        const nextWaveform: WavePoint[] = []

        for (let i = 0; i < samples; i++) {
          let min = 1
          let max = -1
          const start = i * blockSize
          const end = Math.min(start + blockSize, channelData.length)

          for (let j = start; j < end; j++) {
            const value = channelData[j]
            if (value < min) min = value
            if (value > max) max = value
          }

          nextWaveform.push({ min, max })
        }

        if (!cancelled) {
          setWaveform(nextWaveform)
        }

        await audioContext.close()
      } catch (error) {
        console.error("Failed to build waveform", error)
      }
    }

    void buildWaveform()

    return () => {
      cancelled = true
    }
  }, [songFile])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#f5f5f5"
    ctx.fillRect(0, 0, width, height)

    if (!waveform.length) return

    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1

    const midY = height / 2
    const step = width / waveform.length

    for (let i = 0; i < waveform.length; i++) {
      const x = i * step
      const point = waveform[i]
      const y1 = midY + point.min * midY
      const y2 = midY + point.max * midY

      ctx.beginPath()
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
      ctx.stroke()
    }

    if (duration > 0) {
      const progressX = (currentTime / duration) * width
      ctx.strokeStyle = "#dc2626"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(progressX, 0)
      ctx.lineTo(progressX, height)
      ctx.stroke()
    }

    if (duration > 0 && maxTick > 0) {
      ctx.strokeStyle = "rgba(37, 99, 235, 0.35)"
      ctx.lineWidth = 1

      for (const tick of noteTicks) {
        const ratio = tick / maxTick
        const x = ratio * width
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }
  }, [waveform, currentTime, duration, noteTicks, maxTick])

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration || 0)
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    const next = audio.currentTime
    setCurrentTime(next)
    onScrubSeconds(next)
  }

  const handleSliderChange = (value: number) => {
    const audio = audioRef.current
    setCurrentTime(value)

    if (audio) {
      audio.currentTime = value
    }

    onScrubSeconds(value)
  }

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Waveform + Chart Timeline</h3>
          <p className="text-sm text-gray-500">
            The waveform uses the uploaded song. The note markers come from the current .chart file.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowChart((prev) => !prev)}
          className="rounded border px-4 py-2"
          disabled={!chartText.trim()}
        >
          {showChart ? "Hide current .chart" : "View current .chart"}
        </button>
      </div>

      {showChart && (
        <div className="rounded-xl border bg-black text-green-300 p-4 overflow-auto max-h-72 text-xs whitespace-pre-wrap">
          {chartText || "No chart file loaded."}
        </div>
      )}

      <div className="rounded-xl border p-3 bg-white">
        <canvas
          ref={canvasRef}
          width={1200}
          height={180}
          className="w-full h-40 rounded"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={!songFile || disabled}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div className="text-sm text-gray-600 min-w-[110px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        disabled={!songFile || disabled}
        className="w-full"
      />

      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      ) : null}
    </div>
  )
}