"use client"

import { useMemo } from "react"
import { useEditorStore } from "@/lib/editor/editor-store"
import { snapTick } from "@/lib/editor/snap"

const PIXELS_PER_TICK = 0.15

export function Timeline() {
  const project = useEditorStore((s) => s.project)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds)

  const totalTicks = useMemo(() => {
    if (!project) return 4000
    return Math.max(
      4000,
      ...project.notes.map((n) => n.tick + n.length),
      ...project.blocks.map((b) => (b.endTick || b.startTick) + 240),
    )
  }, [project])

  if (!project) {
    return <div className="rounded-2xl border p-4">Upload a song to begin.</div>
  }

  const width = totalTicks * PIXELS_PER_TICK

  return (
    <div className="rounded-2xl border p-4 overflow-x-auto">
      <div className="relative" style={{ width, height: 260 }}>
        {Array.from({ length: Math.ceil(totalTicks / project.timing.resolution) }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-gray-200"
            style={{ left: i * project.timing.resolution * PIXELS_PER_TICK }}
          />
        ))}

        <div className="absolute left-0 right-0 top-6 h-24 border rounded-xl bg-gray-50">
          {project.notes.map((note) => (
            <div
              key={note.id}
              className="absolute h-4 rounded bg-black/70"
              title={`tick ${note.tick}, lane ${note.lane}`}
              style={{
                left: note.tick * PIXELS_PER_TICK,
                top: 8 + note.lane * 16,
                width: Math.max(6, (note.length || 30) * PIXELS_PER_TICK),
              }}
            />
          ))}
        </div>

        <div className="absolute left-0 right-0 top-[150px] h-20 border rounded-xl bg-blue-50">
          {project.blocks.map((block) => {
            const endTick = block.endTick ?? block.startTick + 60
            const widthPx = Math.max(10, (endTick - block.startTick) * PIXELS_PER_TICK)
            return (
              <div
                key={block.id}
                className="absolute top-4 h-10 rounded-xl border bg-white px-2 py-1 text-xs cursor-pointer"
                style={{
                  left: block.startTick * PIXELS_PER_TICK,
                  width: widthPx,
                }}
                onClick={() => setSelectedIds([block.id])}
                onDoubleClick={() => {
                  updateBlock(block.id, (current) => ({
                    ...current,
                    startTick: snapTick(
                      current.startTick + 60,
                      project.timing.resolution,
                      project.ui?.snapSubdivision || 4,
                    ),
                    endTick: current.endTick
                      ? snapTick(
                          current.endTick + 60,
                          project.timing.resolution,
                          project.ui?.snapSubdivision || 4,
                        )
                      : undefined,
                  }))
                }}
              >
                {block.label || block.type}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}