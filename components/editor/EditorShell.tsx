"use client"

import { SongLoader } from "./SongLoader"
import { BlockPalette } from "./BlockPalette"
import { Timeline } from "./Timeline"
import { InspectorPanel } from "./InspectorPanel"
import { UnityPreview } from "./UnityPreview"

export function EditorShell() {
  return (
    <div className="grid grid-cols-12 gap-4 p-6">
      <div className="col-span-3 space-y-4">
        <SongLoader />
        <BlockPalette />
        <InspectorPanel />
      </div>

      <div className="col-span-6 space-y-4">
        <Timeline />
      </div>

      <div className="col-span-3 space-y-4">
        <UnityPreview />
      </div>
    </div>
  )
}