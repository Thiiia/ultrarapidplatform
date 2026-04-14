"use client"

import { nanoid } from "nanoid"
import { BLOCK_REGISTRY } from "@/lib/editor/block-registry"
import { useEditorStore } from "@/lib/editor/editor-store"

export function BlockPalette() {
  const addBlock = useEditorStore((s) => s.addBlock)

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Blocks</h2>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(BLOCK_REGISTRY).map((block) => (
          <button
            key={block.type}
            className="rounded-xl border px-3 py-2 text-left hover:bg-gray-50"
            onClick={() => {
              addBlock({
                id: nanoid(),
                type: block.type,
                startTick: 0,
                endTick: block.hasDuration ? 240 : undefined,
                lane: 2,
                label: block.label,
                params: { ...block.defaultParams },
              })
            }}
          >
            <div className="font-medium">{block.label}</div>
            <div className="text-xs text-gray-500">{block.type}</div>
          </button>
        ))}
      </div>
    </div>
  )
}