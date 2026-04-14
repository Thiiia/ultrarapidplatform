"use client"

import Link from "next/link"

export function SongLoader() {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Song</h2>
        <p className="text-sm text-gray-500">
          Go to the analysis page to upload a song and generate the first chart.
        </p>
      </div>

      <Link
        href="/student/combined-analysis"
        className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Upload Song
      </Link>
    </div>
  )
}