import {
  convertMidiTrackToChart,
  inspectMidiChartSource,
  MAX_MIDI_CHART_FILE_BYTES,
  type MidiChartPreview,
} from "@/lib/editor/midi-chart-import";

type ChartSourceFormat = "chart" | "mid" | "eof"

export type ChartConversionResult = {
  chartText: string
  fileName: string
  sourceFormat: ChartSourceFormat
  warnings?: string[]
  trackName?: string
  noteCount?: number
}

export type ChartSourceInspection = {
  sourceFormat: "mid"
  fileName: string
  preview: MidiChartPreview
}

function getChartSourceFormat(fileName: string): ChartSourceFormat | null {
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".chart")) return "chart"
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) return "mid"
  if (lower.endsWith(".eof")) return "eof"

  return null
}

function getNormalizedChartFileName(fileName: string) {
  return fileName.replace(/\.(chart|mid|midi|eof)$/i, ".chart")
}

export async function convertUploadedChartSourceToChartText(
  file: File,
  trackIndex?: number,
): Promise<ChartConversionResult> {
  const sourceFormat = getChartSourceFormat(file.name)

  if (!sourceFormat) {
    throw new Error(
      "Unsupported chart format. Import a .chart file; MIDI and EOF conversion are not available yet."
    )
  }

  if (sourceFormat === "chart") {
    if (file.size > MAX_MIDI_CHART_FILE_BYTES) {
      throw new Error("Chart files must be 8 MB or smaller to import into the editor.")
    }
    const chartText = await file.text()

    if (!chartText.trim()) {
      throw new Error("The uploaded .chart file was empty.")
    }

    return {
      chartText,
      fileName: getNormalizedChartFileName(file.name),
      sourceFormat: "chart",
    }
  }

  if (sourceFormat === "mid") {
    if (file.size > MAX_MIDI_CHART_FILE_BYTES) {
      throw new Error("MIDI files must be 8 MB or smaller to import into the chart editor.")
    }
    if (!Number.isSafeInteger(trackIndex) || (trackIndex ?? -1) < 0) {
      throw new Error("Choose a supported MIDI track before importing.")
    }
    const converted = convertMidiTrackToChart(
      await file.arrayBuffer(),
      file.name,
      trackIndex as number,
    )
    return {
      chartText: converted.chartText,
      fileName: converted.fileName,
      sourceFormat: "mid",
      warnings: converted.warnings,
      trackName: converted.trackName,
      noteCount: converted.noteCount,
    }
  }

  if (sourceFormat === "eof") {
    throw new Error(
      "EOF-to-.chart conversion is not available yet. Import a .chart file instead."
    )
  }

  throw new Error("Unsupported chart source.")
}

export async function inspectUploadedChartSource(file: File): Promise<ChartSourceInspection> {
  if (!/\.(mid|midi)$/i.test(file.name)) {
    throw new Error("Choose a .mid or .midi file to preview its chart tracks.")
  }
  if (file.size > MAX_MIDI_CHART_FILE_BYTES) {
    throw new Error("MIDI files must be 8 MB or smaller to import into the chart editor.")
  }

  return {
    sourceFormat: "mid",
    fileName: file.name,
    preview: inspectMidiChartSource(await file.arrayBuffer()),
  }
}
