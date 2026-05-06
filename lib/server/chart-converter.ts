type ChartSourceFormat = "chart" | "mid" | "eof"

export type ChartConversionResult = {
  chartText: string
  fileName: string
  sourceFormat: ChartSourceFormat
  warnings?: string[]
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
  file: File
): Promise<ChartConversionResult> {
  const sourceFormat = getChartSourceFormat(file.name)

  if (!sourceFormat) {
    throw new Error(
      "Unsupported chart format. Please upload a .chart, .mid, .midi, or .eof file."
    )
  }

  if (sourceFormat === "chart") {
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

  // These branches are the server-side hooks for future converters.
  // Keep the browser/editor workflow stable by converting everything
  // into .chart text before it reaches the editor.

  if (sourceFormat === "mid") {
    throw new Error(
      "MIDI upload is wired into the flow, but MIDI-to-.chart conversion is not implemented yet on the server."
    )
  }

  if (sourceFormat === "eof") {
    throw new Error(
      "EOF upload is wired into the flow, but EOF-to-.chart conversion is not implemented yet on the server."
    )
  }

  throw new Error("Unsupported chart source.")
}