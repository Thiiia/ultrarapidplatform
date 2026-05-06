import { NextResponse } from "next/server"
import { convertUploadedChartSourceToChartText } from "@/lib/server/chart-converter"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No chart source file was uploaded." },
        { status: 400 }
      )
    }

    const result = await convertUploadedChartSourceToChartText(file)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[chart/convert] Conversion failed", error)

    const message =
      error instanceof Error ? error.message : "Chart conversion failed."

    return NextResponse.json({ error: message }, { status: 400 })
  }
}