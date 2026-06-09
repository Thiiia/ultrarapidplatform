import type { ChartProject } from "./types";
import type { LegacySidecarPayload, SidecarPayload } from "./editor-store";

function escapeChartString(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\"');
}

function sidecarEventSortKey(type: string) {
  if (type === "ALG_MECHANIC") return 0;
  if (type === "ALG_EQUATION_STATE") return 1;
  return 2;
}

function sortLegacySidecar(sidecar: LegacySidecarPayload) {
  return {
    version: 1,
    events: [...sidecar.events].sort((left, right) => {
      if (left.tick !== right.tick) {
        return left.tick - right.tick;
      }

      return sidecarEventSortKey(left.type) - sidecarEventSortKey(right.type);
    }),
  };
}

export function projectToChart(project: ChartProject): string {
  const song = `[Song]\n{\n  Name = \"${escapeChartString(project.song.title)}\"\n  Artist = \"${escapeChartString(project.song.artist)}\"\n  Resolution = \"${project.timing.resolution}\"\n}`;

  const syncTrack = `[SyncTrack]\n{\n  0 = B ${Math.round(project.timing.bpm * 1000)}\n}`;

  const eventsBody = [...project.events]
    .sort((a, b) => a.tick - b.tick)
    .map(
      (event) =>
        `  ${event.tick} = E \"${escapeChartString(event.eventType)}:${escapeChartString(event.value)}\"`,
    )
    .join("\n");

  const events = `[Events]\n{\n${eventsBody}\n}`;

  const expertNotes = [...project.notes]
    .filter((n) => n.difficulty === "expert")
    .sort((a, b) => a.tick - b.tick || a.lane - b.lane)
    .map((note) => `  ${note.tick} = N ${note.lane} ${note.length}`)
    .join("\n");

  const expert = `[ExpertSingle]\n{\n${expertNotes}\n}`;

  return [song, syncTrack, events, expert].join("\n\n");
}

export function projectToSidecarJson(sidecar: SidecarPayload): string {
  if (sidecar.version === 2) {
    return JSON.stringify(
      {
        version: 2,
        maxEquationSlots: sidecar.maxEquationSlots,
        equations: sidecar.equations,
      },
      null,
      2,
    );
  }

  return JSON.stringify(sortLegacySidecar(sidecar), null, 2);
}
