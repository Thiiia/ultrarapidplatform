import { create } from "zustand"
import { ChartProject, GameplayBlock } from "./types"

function cloneProject(project: ChartProject): ChartProject {
  return JSON.parse(JSON.stringify(project))
}

type EditorStore = {
  project: ChartProject | null
  selectedIds: string[]
  setProject: (project: ChartProject) => void
  updateProject: (updater: (project: ChartProject) => ChartProject) => void
  setSelectedIds: (ids: string[]) => void
  addBlock: (block: GameplayBlock) => void
  updateBlock: (id: string, updater: (block: GameplayBlock) => GameplayBlock) => void
  removeSelected: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  project: null,
  selectedIds: [],
  setProject: (project) => set({ project, selectedIds: [] }),
  updateProject: (updater) =>
    set((state) => ({
      project: state.project ? updater(cloneProject(state.project)) : null,
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addBlock: (block) =>
    set((state) => {
      if (!state.project) return state
      const project = cloneProject(state.project)
      project.blocks.push(block)
      project.metadata.updatedAt = new Date().toISOString()
      project.metadata.source = "edited"
      project.difficulties.expert.blockIds.push(block.id)
      return { project }
    }),
  updateBlock: (id, updater) =>
    set((state) => {
      if (!state.project) return state
      const project = cloneProject(state.project)
      project.blocks = project.blocks.map((block) => (block.id === id ? updater(block) : block))
      project.metadata.updatedAt = new Date().toISOString()
      project.metadata.source = "edited"
      return { project }
    }),
  removeSelected: () =>
    set((state) => {
      if (!state.project) return state
      const selected = new Set(state.selectedIds)
      const project = cloneProject(state.project)
      project.blocks = project.blocks.filter((b) => !selected.has(b.id))
      project.notes = project.notes.filter((n) => !selected.has(n.id))
      project.metadata.updatedAt = new Date().toISOString()
      project.metadata.source = "edited"
      return { project, selectedIds: [] }
    }),
}))