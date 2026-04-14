"use client"

import { useState } from "react"
import { useEditorStore } from "@/lib/editor/editor-store"
import { ChartProject } from "@/lib/editor/types"

type CreateProjectResponse = {
  project: ChartProject
  chartFile: string
}

export function SongLoader() {
  const [loading, setLoading] = useState(false)
  const setProject = useEditorStore((s) => s.setProject)

  async function onFileChange(file: File) {
    setLoading(true)
    try {
      const form = new FormData()
      form.append("audio_file", file)

      const res = await fetch("/api/project/create", {
        method: "POST",
        body: form,
      })

      if (!res.ok) throw new Error("Failed to create project")
      const data: CreateProjectResponse = await res.json()
      setProject(data.project)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Song</h2>
        <p className="text-sm text-gray-500">Upload a song to generate the first chart.</p>
      </div>
      <input
        type="file"
        accept="audio/*"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileChange(file)
        }}
      />
      {loading ? <p className="text-sm">Generating project...</p> : null}
    </div>
  )
}