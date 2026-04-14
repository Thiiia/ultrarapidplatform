"use client"

import UnityPlayer from "@/app/components/UnityPlayer"

export function UnityPreview() {
  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Gameplay Preview</h2>
        <p className="text-sm text-gray-500">
          Live Unity preview driven by the editor.
        </p>
      </div>

      <UnityPlayer />
    </div>
  )
}