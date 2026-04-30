"use client"

import UnityPlayer from "@/app/components/UnityPlayer"

type UnityPreviewProps = {
  enabled: boolean
}

export function UnityPreview({ enabled }: UnityPreviewProps) {
  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Gameplay Preview</h2>
        <p className="text-sm text-gray-500">
          Unity loads after both files are uploaded and Start is clicked.
        </p>
      </div>

      {enabled ? (
        <div className="mx-auto w-full max-w-6xl">
          <UnityPlayer />
        </div>
      ) : (
        <div className="rounded-xl border bg-black/5 p-10 text-center text-sm text-gray-500">
          Unity preview is idle. Upload a song file and a .chart file, then click Start.
        </div>
      )}
    </div>
  )
}