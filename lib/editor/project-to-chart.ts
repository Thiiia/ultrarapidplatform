import { ChartProject } from "./types"

export function projectToChart(project: ChartProject): string {
  const song = `[Song]\n{\n  Name = \"${project.song.title}\"\n  Artist = \"${project.song.artist}\"\n  Resolution = \"${project.timing.resolution}\"\n}`

  const syncTrack = `[SyncTrack]\n{\n  0 = B ${Math.round(project.timing.bpm * 1000)}\n}`

  const eventsBody = project.events
    .sort((a, b) => a.tick - b.tick)
    .map((event) => `  ${event.tick} = E \"${event.eventType}:${event.value}\"`)
    .join("\n")

  const events = `[Events]\n{\n${eventsBody}\n}`

  const expertNotes = project.notes
    .filter((n) => n.difficulty === "expert")
    .sort((a, b) => a.tick - b.tick || a.lane - b.lane)
    .map((note) => `  ${note.tick} = N ${note.lane} ${note.length}`)
    .join("\n")

  const expert = `[ExpertSingle]\n{\n${expertNotes}\n}`

  return [song, syncTrack, events, expert].join("\n\n")
}