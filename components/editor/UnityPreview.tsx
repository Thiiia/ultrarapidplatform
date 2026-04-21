"use client"

import UnityPlayer from "@/app/components/UnityPlayer"

export function UnityPreview() {
  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Gameplay Preview</h2>
        <p className="text-sm text-gray-500">
          Live Unity preview driven by the editor.
        </p>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <UnityPlayer />
      </div>
    </div>
  )
}