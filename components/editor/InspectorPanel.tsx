"use client"

import { BLOCK_REGISTRY } from "@/lib/editor/block-registry"
import { useEditorStore } from "@/lib/editor/editor-store"

export function InspectorPanel() {
  const project = useEditorStore((s) => s.project)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateBlock = useEditorStore((s) => s.updateBlock)

  const selectedBlock = project?.blocks.find((b) => b.id === selectedIds[0])

  if (!selectedBlock) {
    return (
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <p className="text-sm text-gray-500">Select a block to edit it.</p>
      </div>
    )
  }

  const definition = BLOCK_REGISTRY[selectedBlock.type]

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Inspector</h2>
        <p className="text-sm text-gray-500">{definition.label}</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm">Start Tick</span>
        <input
          className="w-full rounded border px-3 py-2"
          type="number"
          value={selectedBlock.startTick}
          onChange={(e) => {
            const value = Number(e.target.value)
            updateBlock(selectedBlock.id, (block) => ({ ...block, startTick: value }))
          }}
        />
      </label>

      {definition.hasDuration ? (
        <label className="block space-y-1">
          <span className="text-sm">End Tick</span>
          <input
            className="w-full rounded border px-3 py-2"
            type="number"
            value={selectedBlock.endTick || selectedBlock.startTick + 240}
            onChange={(e) => {
              const value = Number(e.target.value)
              updateBlock(selectedBlock.id, (block) => ({ ...block, endTick: value }))
            }}
          />
        </label>
      ) : null}
    </div>
  )
}