import { ChartProject, UnityPreviewPayload } from "./types"

export function projectToUnityPreview(project: ChartProject): UnityPreviewPayload {
  return {
    bpm: project.timing.bpm,
    resolution: project.timing.resolution,
    durationSeconds: project.song.durationSeconds,
    notes: project.notes.map((note) => ({
      tick: note.tick,
      lane: note.lane,
      length: note.length,
    })),
    blocks: project.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      startTick: block.startTick,
      endTick: block.endTick,
      lane: block.lane,
      params: block.params,
    })),
    events: project.events.map((event) => ({
      tick: event.tick,
      eventType: event.eventType,
      value: event.value,
    })),
  }
}