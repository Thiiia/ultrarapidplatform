export const CHART_NOTE_DIFFICULTIES = [
  "EasySingle",
  "MediumSingle",
  "HardSingle",
  "ExpertSingle",
] as const;

export type ChartNoteDifficulty = (typeof CHART_NOTE_DIFFICULTIES)[number];

export type ChartLaneNote = {
  tick: number;
  lane: 0 | 1 | 2 | 3 | 4;
  length: number;
};

type ChartLaneNoteInput = {
  tick: number;
  lane: number;
  length: number;
};

export type ChartDiagnosticSeverity = "error" | "warning" | "info";

export type ChartDiagnostic = {
  code:
    | "missing-song-section"
    | "missing-resolution"
    | "invalid-resolution"
    | "invalid-offset"
    | "missing-sync-track"
    | "invalid-tempo"
    | "tempo-order"
    | "missing-tempo-at-zero"
    | "invalid-time-signature"
    | "invalid-note"
    | "no-playable-notes"
    | "offset-defaulted";
  severity: ChartDiagnosticSeverity;
  title: string;
  detail: string;
  tick?: number;
};

export type ChartFileAnalysis = {
  resolution: number | null;
  offsetSeconds: number | null;
  noteCounts: Record<ChartNoteDifficulty, number>;
  diagnostics: ChartDiagnostic[];
};

function extractSection(chartText: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return chartText.match(new RegExp("\\[" + escapedName + "\\]\\s*\\{([\\s\\S]*?)\\}", "i"))?.[1] ?? null;
}

function addDiagnostic(
  diagnostics: ChartDiagnostic[],
  diagnostic: ChartDiagnostic,
) {
  if (!diagnostics.some((existing) => existing.code === diagnostic.code && existing.tick === diagnostic.tick)) {
    diagnostics.push(diagnostic);
  }
}

export function parseChartLaneNotes(
  chartText: string,
  difficulty: ChartNoteDifficulty,
): ChartLaneNote[] {
  const body = extractSection(chartText, difficulty);
  if (!body) return [];

  const notes: ChartLaneNote[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*(-?\d+)\s*=\s*N\s+(-?\d+)\s+(-?\d+)\s*$/);
    if (!match) continue;

    const tick = Number(match[1]);
    const lane = Number(match[2]);
    const length = Number(match[3]);
    if (
      !Number.isSafeInteger(tick) || tick < 0 ||
      !Number.isInteger(lane) || lane < 0 || lane > 4 ||
      !Number.isSafeInteger(length) || length < 0
    ) continue;

    notes.push({ tick, lane: lane as ChartLaneNote["lane"], length });
  }

  return notes.sort((left, right) => left.tick - right.tick || left.lane - right.lane);
}

function validateChartLaneNote(note: ChartLaneNoteInput) {
  if (!Number.isSafeInteger(note.tick) || note.tick < 0) {
    throw new Error("Chart note ticks must be non-negative whole numbers.");
  }
  if (!Number.isInteger(note.lane) || note.lane < 0 || note.lane > 4) {
    throw new Error("Chart note lanes must be between 0 and 4.");
  }
  if (!Number.isSafeInteger(note.length) || note.length < 0) {
    throw new Error("Chart note sustain lengths must be non-negative whole numbers.");
  }
}

function mutateChartLaneNote(
  chartText: string,
  difficulty: ChartNoteDifficulty,
  note: ChartLaneNoteInput,
  action: "upsert" | "remove",
) {
  validateChartLaneNote(note);
  if (!/\[Song\]\s*\{/i.test(chartText)) {
    throw new Error("Add a valid [Song] section before editing chart notes.");
  }

  const newline = chartText.includes("\r\n") ? "\r\n" : "\n";
  const sectionPattern = new RegExp("(\\[" + difficulty + "\\]\\s*\\{)([\\s\\S]*?)(\\})", "ig");
  const sections = [...chartText.matchAll(sectionPattern)];
  if (sections.length > 1) {
    throw new Error("This chart has more than one " + difficulty + " section; merge them before editing notes.");
  }

  if (sections.length === 0) {
    if (action === "remove") return chartText;
    const suffix = [
      "[" + difficulty + "]",
      "{",
      "  " + note.tick + " = N " + note.lane + " " + note.length,
      "}",
    ].join(newline);
    const separator = chartText.length === 0 || chartText.endsWith("\n") ? "" : newline;
    return chartText + separator + suffix + (chartText.endsWith("\n") ? newline : "");
  }

  const section = sections[0];
  const body = section[2];
  const linePattern = /^([ \t]*)(-?\d+)([ \t]*=[ \t]*N[ \t]+)(-?\d+)([ \t]+)(-?\d+)([ \t]*)$/gim;
  const matches = [...body.matchAll(linePattern)];
  const matchingNotes = matches.filter((match) => Number(match[2]) === note.tick && Number(match[4]) === note.lane);
  let nextBody = body;

  if (action === "remove") {
    for (const match of matchingNotes.reverse()) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const lineEnding = nextBody.slice(end).match(/^\r?\n/)?.[0];
      if (lineEnding) {
        nextBody = nextBody.slice(0, start) + nextBody.slice(end + lineEnding.length);
      } else {
        nextBody = nextBody.slice(0, start) + nextBody.slice(end);
      }
    }
  } else if (matchingNotes.length > 0) {
    const first = matchingNotes[0];
    const start = first.index ?? 0;
    const updatedLine = first[1] + first[2] + first[3] + first[4] + first[5] + note.length + first[7];
    for (const duplicate of matchingNotes.slice(1).reverse()) {
      const startDuplicate = duplicate.index ?? 0;
      const endDuplicate = startDuplicate + duplicate[0].length;
      const lineEnding = nextBody.slice(endDuplicate).match(/^\r?\n/)?.[0];
      if (lineEnding) nextBody = nextBody.slice(0, startDuplicate) + nextBody.slice(endDuplicate + lineEnding.length);
      else nextBody = nextBody.slice(0, startDuplicate) + nextBody.slice(endDuplicate);
    }
    nextBody = nextBody.slice(0, start) + updatedLine + nextBody.slice(start + first[0].length);
  } else {
    const insertBefore = matches.find((match) => Number(match[2]) > note.tick);
    const insertionIndex = insertBefore?.index ?? body.length;
    const prefix = body.slice(0, insertionIndex);
    const suffix = body.slice(insertionIndex);
    const row = "  " + note.tick + " = N " + note.lane + " " + note.length;
    nextBody = prefix.endsWith("\n")
      ? prefix + row + newline + suffix
      : prefix + newline + row + newline + suffix;
  }

  const sectionStart = section.index ?? 0;
  const nextSection = section[1] + nextBody + section[3];
  return chartText.slice(0, sectionStart) + nextSection + chartText.slice(sectionStart + section[0].length);
}

/** Add or update one note in a difficulty while preserving all other chart text. */
export function upsertChartLaneNote(
  chartText: string,
  difficulty: ChartNoteDifficulty,
  note: ChartLaneNoteInput,
) {
  return mutateChartLaneNote(chartText, difficulty, note, "upsert");
}

/** Remove the note at one tick and lane without rewriting other chart sections. */
export function removeChartLaneNote(
  chartText: string,
  difficulty: ChartNoteDifficulty,
  note: Pick<ChartLaneNoteInput, "tick" | "lane">,
) {
  return mutateChartLaneNote(chartText, difficulty, { ...note, length: 0 }, "remove");
}

export function analyzeChartFile(chartText: string): ChartFileAnalysis {
  const diagnostics: ChartDiagnostic[] = [];
  const song = extractSection(chartText, "Song");
  const syncTrack = extractSection(chartText, "SyncTrack");
  const noteCounts = Object.fromEntries(
    CHART_NOTE_DIFFICULTIES.map((difficulty) => [
      difficulty,
      parseChartLaneNotes(chartText, difficulty).length,
    ]),
  ) as Record<ChartNoteDifficulty, number>;

  for (const difficulty of CHART_NOTE_DIFFICULTIES) {
    const body = extractSection(chartText, difficulty);
    if (!body) continue;
    let previousTick = -1;
    for (const line of body.split(/\r?\n/)) {
      if (!/=\s*N\b/i.test(line)) continue;
      const match = line.match(/^\s*(-?\d+)\s*=\s*N\s+(-?\d+)\s+(-?\d+)\s*$/i);
      const tick = Number(match?.[1]);
      const lane = Number(match?.[2]);
      const length = Number(match?.[3]);
      if (
        !match || !Number.isSafeInteger(tick) || tick < 0 ||
        !Number.isInteger(lane) || lane < 0 || lane > 4 ||
        !Number.isSafeInteger(length) || length < 0 || tick < previousTick
      ) {
        addDiagnostic(diagnostics, {
          code: "invalid-note",
          severity: "error",
          title: difficulty + " contains an invalid note",
          detail: "Notes must use ordered, non-negative ticks, lanes 0–4, and non-negative integer lengths.",
          tick: Number.isSafeInteger(tick) ? tick : undefined,
        });
      }
      if (Number.isSafeInteger(tick) && tick >= 0) previousTick = tick;
    }
  }

  if (!song) {
    addDiagnostic(diagnostics, {
      code: "missing-song-section",
      severity: "error",
      title: "Song section is missing",
      detail: "Add a [Song] section so the chart resolution and audio offset can be read.",
    });
  }

  const resolutionLines = song?.match(/^\s*Resolution\s*=.*$/gim) ?? [];
  const resolutionMatch = song?.match(/^\s*Resolution\s*=\s*"?(\d+)"?\s*$/im);
  const parsedResolution = Number(resolutionMatch?.[1] ?? NaN);
  const resolution = Number.isSafeInteger(parsedResolution) && parsedResolution > 0
    ? parsedResolution
    : null;
  if (resolutionLines.length === 0) {
    addDiagnostic(diagnostics, {
      code: "missing-resolution",
      severity: "error",
      title: "Ticks per beat are missing",
      detail: "Set Resolution to a positive integer in the [Song] section.",
    });
  } else if (resolution === null || resolutionLines.length > 1) {
    addDiagnostic(diagnostics, {
      code: "invalid-resolution",
      severity: "error",
      title: "Ticks per beat are invalid",
      detail: "Resolution must be a positive whole number.",
    });
  }

  const offsetLines = song?.match(/^\s*Offset\s*=.*$/gim) ?? [];
  const offsetMatch = song?.match(/^\s*Offset\s*=\s*"?(-?(?:\d+(?:\.\d*)?|\.\d+))"?\s*$/im);
  const parsedOffset = offsetMatch ? Number(offsetMatch[1]) : 0;
  const offsetSeconds = Number.isFinite(parsedOffset) ? parsedOffset : null;
  if (offsetLines.length === 0 && song) {
    addDiagnostic(diagnostics, {
      code: "offset-defaulted",
      severity: "info",
      title: "Audio offset defaults to zero",
      detail: "No Offset is written, so the chart is aligned at 0.000 seconds.",
    });
  } else if (offsetSeconds === null || offsetLines.length > 1) {
    addDiagnostic(diagnostics, {
      code: "invalid-offset",
      severity: "error",
      title: "Audio offset is invalid",
      detail: "Use one finite Offset value in seconds in the [Song] section.",
    });
  }

  if (!syncTrack) {
    addDiagnostic(diagnostics, {
      code: "missing-sync-track",
      severity: "error",
      title: "SyncTrack section is missing",
      detail: "Add a [SyncTrack] section with a tempo map to place notes against the song.",
    });
  } else {
    const tempoTicks: number[] = [];
    let sawMalformedTempo = false;
    for (const line of syncTrack.split(/\r?\n/)) {
      if (!/^\s*-?\d+\s*=\s*B\b/i.test(line)) continue;
      const match = line.match(/^\s*(-?\d+)\s*=\s*B\s+(-?\d+)\s*$/i);
      if (!match) {
        sawMalformedTempo = true;
        continue;
      }
      const tick = Number(match[1]);
      const milliBpm = Number(match[2]);
      if (!Number.isSafeInteger(tick) || tick < 0 || !Number.isSafeInteger(milliBpm) || milliBpm <= 0) {
        addDiagnostic(diagnostics, {
          code: "invalid-tempo",
          severity: "error",
          title: "A tempo marker is invalid",
          detail: "Tempo markers need a non-negative tick and a positive BPM × 1,000 value.",
          tick: Number.isSafeInteger(tick) ? tick : undefined,
        });
        continue;
      }
      if (tempoTicks.length && tick < tempoTicks[tempoTicks.length - 1]) {
        addDiagnostic(diagnostics, {
          code: "tempo-order",
          severity: "warning",
          title: "Tempo markers are out of order",
          detail: "Sort SyncTrack events by tick so editors interpret the tempo map consistently.",
          tick,
        });
      }
      tempoTicks.push(tick);
    }

    if (sawMalformedTempo) {
      addDiagnostic(diagnostics, {
        code: "invalid-tempo",
        severity: "error",
        title: "A tempo marker could not be read",
        detail: "Use the format <tick> = B <BPM × 1,000> for each tempo change.",
      });
    }
    if (!tempoTicks.includes(0)) {
      addDiagnostic(diagnostics, {
        code: "missing-tempo-at-zero",
        severity: "warning",
        title: "No starting tempo at tick 0",
        detail: "The editor uses 120 BPM until the first tempo marker. Add an explicit starting tempo to make the chart easier to exchange.",
        tick: 0,
      });
    }

    for (const line of syncTrack.split(/\r?\n/)) {
      if (!/^\s*-?\d+\s*=\s*TS\b/i.test(line)) continue;
      const match = line.match(/^\s*(-?\d+)\s*=\s*TS\s+(\d+)(?:\s+(\d+))?\s*$/i);
      const tick = Number(match?.[1]);
      const numerator = Number(match?.[2]);
      const denominatorExponent = Number(match?.[3] ?? 2);
      if (
        !match || !Number.isSafeInteger(tick) || tick < 0 ||
        numerator < 1 || numerator > 64 ||
        denominatorExponent < 0 || denominatorExponent > 10
      ) {
        addDiagnostic(diagnostics, {
          code: "invalid-time-signature",
          severity: "error",
          title: "A time signature marker is invalid",
          detail: "Use a positive numerator and a denominator exponent from 0 to 10.",
          tick: Number.isSafeInteger(tick) ? tick : undefined,
        });
      }
    }
  }

  if (Object.values(noteCounts).every((count) => count === 0)) {
    addDiagnostic(diagnostics, {
      code: "no-playable-notes",
      severity: "warning",
      title: "No supported five-lane notes found",
      detail: "The four playable difficulty lanes are empty or the chart uses another instrument format.",
    });
  }

  return { resolution, offsetSeconds, noteCounts, diagnostics };
}

export function replaceChartOffset(chartText: string, offsetSeconds: number): string {
  if (!Number.isFinite(offsetSeconds)) {
    throw new Error("Chart offset must be a finite number of seconds.");
  }

  const songSection = chartText.match(/(\[Song\]\s*\{)([\s\S]*?)(\})/i);
  if (!songSection) throw new Error("Cannot adjust timing because the chart has no [Song] section.");

  const offsetLine = /^([ \t]*Offset[ \t]*=[ \t]*)(?:"[^"\r\n]*"|[^\r\n]*?)([ \t]*)$/gim;
  const lineCount = [...songSection[2].matchAll(offsetLine)].length;
  if (lineCount > 1) throw new Error("Cannot adjust timing while the chart has more than one Offset entry.");

  const normalizedOffset = (Math.round(offsetSeconds * 1000) / 1000).toFixed(3);
  let nextBody: string;
  if (lineCount === 1) {
    nextBody = songSection[2].replace(offsetLine, "$1" + normalizedOffset + "$2");
  } else {
    const newline = chartText.includes("\r\n") ? "\r\n" : "\n";
    const body = songSection[2];
    const trailingWhitespace = body.match(/[ \t\r\n]*$/)?.[0] ?? "";
    const content = body.slice(0, body.length - trailingWhitespace.length);
    nextBody = content + newline + "  Offset = " + normalizedOffset + newline + trailingWhitespace;
  }

  return chartText.slice(0, songSection.index) +
    songSection[1] + nextBody + songSection[3] +
    chartText.slice((songSection.index ?? 0) + songSection[0].length);
}
