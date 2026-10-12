import { NextResponse } from "next/server"
import {
  convertUploadedChartSourceToChartText,
  inspectUploadedChartSource,
} from "@/lib/server/chart-converter"
import { MAX_MIDI_CHART_FILE_BYTES } from "@/lib/editor/midi-chart-import"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > MAX_MIDI_CHART_FILE_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: "Chart and MIDI uploads must be 8 MB or smaller." },
        { status: 413 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No chart source file was uploaded." },
        { status: 400 }
      )
    }

    if (file.size > MAX_MIDI_CHART_FILE_BYTES) {
      return NextResponse.json(
        { error: "Chart and MIDI uploads must be 8 MB or smaller." },
        { status: 413 },
      )
    }

    if (formData.get("action") === "inspect") {
      const inspection = await inspectUploadedChartSource(file)
      return NextResponse.json(inspection)
    }

    const rawTrackIndex = formData.get("trackIndex")
    const trackIndex = rawTrackIndex === null ? undefined : Number(rawTrackIndex)
    if (trackIndex !== undefined && !Number.isSafeInteger(trackIndex)) {
      return NextResponse.json({ error: "Choose a valid MIDI track." }, { status: 400 })
    }

    const result = await convertUploadedChartSourceToChartText(file, trackIndex)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[chart/convert] Conversion failed", error)

    const message =
      error instanceof Error ? error.message : "Chart conversion failed."

    const status = message.includes("8 MB or smaller") ? 413 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
