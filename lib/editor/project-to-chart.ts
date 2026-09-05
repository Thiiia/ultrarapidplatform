import type { ChartProject } from "./types";

type LegacySidecarEvent = {
  tick: number;
  type: string;
  [key: string]: unknown;
};

type LegacySidecarPayload = {
  version: 1;
  events: LegacySidecarEvent[];
};

type EquationSidecarPayload = {
  version: 2;
  maxEquationSlots: number;
  equations: unknown[];
};

type ProjectSidecarPayload = LegacySidecarPayload | EquationSidecarPayload;

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
  if (project.sourceChart) {
    // Imported charts own their sync map, metadata and unedited difficulties.
    // The current editor controls only five-lane Expert note rows.
    const newline = project.sourceChart.includes("\r\n") ? "\r\n" : "\n";
    const notes = [...project.notes]
      .filter((note) => note.difficulty === "expert")
      .sort((a, b) => a.tick - b.tick || a.lane - b.lane);
    let index = 0;
    const section = /(^\[ExpertSingle\][ \t]*\r?\n[ \t]*\{)([\s\S]*?)(^[ \t]*\})/m;
    const match = project.sourceChart.match(section);
    if (!match) {
      if (!notes.length) return project.sourceChart;
      return project.sourceChart + newline + "[ExpertSingle]" + newline + "{" + newline +
        notes.map(n => `  ${n.tick} = N ${n.lane} ${n.length}`).join(newline) + newline + "}" + newline;
    }
    return project.sourceChart.replace(section, (_all, header: string, body: string, footer: string) => {
      let updated = body.replace(/^([ \t]*)(\d+)[ \t]*=[ \t]*N[ \t]+([0-4])[ \t]+(\d+)[ \t]*(\r?\n|$)/gm,
        (row, indent: string, tick: string, lane: string, length: string, ending: string) => {
          const note = notes[index++];
          if (!note) return "";
          if (note.tick === Number(tick) && note.lane === Number(lane) && note.length === Number(length)) return row;
          return `${indent}${note.tick} = N ${note.lane} ${note.length}${ending}`;
        });
      if (index < notes.length) {
        updated += notes.slice(index).map(n => `  ${n.tick} = N ${n.lane} ${n.length}${newline}`).join("");
      }
      return header + updated + footer;
    });
  }
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

export function projectToSidecarJson(sidecar: ProjectSidecarPayload): string {
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
