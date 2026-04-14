"use client"

import { useEffect } from "react"
import { useEditorStore } from "@/lib/editor/editor-store"
import { projectToUnityPreview } from "@/lib/editor/project-to-unity-preview"
import { loadUnityPreview } from "@/lib/editor/unity-bridge"

export function UnityPreview() {
  const project = useEditorStore((s) => s.project)

  useEffect(() => {
    if (!project) return
    const timeout = window.setTimeout(() => {
      loadUnityPreview(projectToUnityPreview(project))
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [project])

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Unity Preview</h2>
        <p className="text-sm text-gray-500">Replace this box with the real Unity WebGL mount.</p>
      </div>
      <div className="aspect-video rounded-xl bg-black/5 border flex items-center justify-center text-sm text-gray-500">
        Unity WebGL container
      </div>
    </div>
  )
}