import { Midi, type Track } from "@tonejs/midi";
import type { ChartNoteDifficulty } from "./chart-insights";

export const MAX_MIDI_CHART_FILE_BYTES = 8 * 1024 * 1024;

const MIDI_5_FRET_TRACK_NAMES = new Set([
  "PART GUITAR",
  "PART GUITAR COOP",
  "PART BASS",
  "PART RHYTHM",
  "PART KEYS",
  "T1 GEMS",
]);

const DIFFICULTY_BASES: ReadonlyArray<{ key: ChartNoteDifficulty; base: number }> = [
  { key: "EasySingle", base: 60 },
  { key: "MediumSingle", base: 72 },
  { key: "HardSingle", base: 84 },
  { key: "ExpertSingle", base: 96 },
];

export type MidiTrackPreview = {
  trackIndex: number;
  name: string;
  noteCount: number;
  difficultyCounts: Record<ChartNoteDifficulty, number>;
  openNoteCount: number;
  modifierCount: number;
  otherNoteCount: number;
  warnings: string[];
};

export type MidiTempoPreview = { tick: number; bpm: number };
export type MidiTimeSignaturePreview = { tick: number; numerator: number; denominator: number };

export type MidiChartPreview = {
  midiFormat: 0 | 1;
  ppq: number;
  tempos: MidiTempoPreview[];
  timeSignatures: MidiTimeSignaturePreview[];
  tracks: MidiTrackPreview[];
  warnings: string[];
};

export type MidiChartConversion = {
  chartText: string;
  fileName: string;
  trackName: string;
  noteCount: number;
  warnings: string[];
};

type MidiSourceInput = ArrayBuffer | Uint8Array | ArrayLike<number>;

function toMidiBytes(input: MidiSourceInput): Uint8Array {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  return Uint8Array.from(input);
}

function parseMidiSource(input: MidiSourceInput) {
  const bytes = toMidiBytes(input);
  if (bytes.byteLength > MAX_MIDI_CHART_FILE_BYTES) {
    throw new Error("MIDI files must be 8 MB or smaller to import into the chart editor.");
  }
  if (bytes.byteLength < 14) throw new Error("This file is too short to be a Standard MIDI File.");
  if (String.fromCharCode(...bytes.slice(0, 4)) !== "MThd") {
    throw new Error("This file does not start with a Standard MIDI File header.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(4, false);
  if (headerLength < 6 || 8 + headerLength > bytes.byteLength) {
    throw new Error("The MIDI header is incomplete or malformed.");
  }

  const midiFormat = view.getUint16(8, false);
  if (midiFormat !== 0 && midiFormat !== 1) {
    throw new Error("Only single-track (type 0) and multi-track (type 1) MIDI files are supported.");
  }
  const trackCount = view.getUint16(10, false);
  const division = view.getUint16(12, false);
  if (division & 0x8000) {
    throw new Error("SMPTE-timed MIDI files are not supported. Export with ticks per quarter note (PPQ) timing.");
  }
  if (division <= 0 || trackCount <= 0) {
    throw new Error("The MIDI file needs at least one track and a positive PPQ resolution.");
  }

  let midi: Midi;
  try {
    midi = new Midi(bytes);
  } catch {
    throw new Error("The MIDI data could not be read. Re-export it as a Standard MIDI File.");
  }
  if (!Number.isSafeInteger(midi.header.ppq) || midi.header.ppq <= 0 || midi.header.ppq !== division) {
    throw new Error("The MIDI PPQ timing could not be read safely.");
  }

  return { midi, midiFormat: midiFormat as 0 | 1 };
}

function normalizedTrackName(name: string) {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

type PitchClassification =
  | { kind: "playable"; difficulty: ChartNoteDifficulty; lane: 0 | 1 | 2 | 3 | 4 }
  | { kind: "open" }
  | { kind: "modifier" }
  | { kind: "other" };

function classifyPitch(pitch: number): PitchClassification {
  for (const { key, base } of DIFFICULTY_BASES) {
    if (pitch >= base && pitch <= base + 4) {
      return { kind: "playable", difficulty: key, lane: (pitch - base) as 0 | 1 | 2 | 3 | 4 };
    }
    if (pitch === base - 1) return { kind: "open" };
    if (pitch === base + 5 || pitch === base + 6) return { kind: "modifier" };
  }
  return { kind: "other" };
}

function analyzeTrack(track: Track, trackIndex: number): MidiTrackPreview | null {
  const name = track.name.trim();
  if (!MIDI_5_FRET_TRACK_NAMES.has(normalizedTrackName(name))) return null;

  const difficultyCounts = Object.fromEntries(
    DIFFICULTY_BASES.map(({ key }) => [key, 0]),
  ) as Record<ChartNoteDifficulty, number>;
  let openNoteCount = 0;
  let modifierCount = 0;
  let otherNoteCount = 0;

  for (const note of track.notes) {
    const classification = classifyPitch(note.midi);
    if (classification.kind === "playable") difficultyCounts[classification.difficulty] += 1;
    else if (classification.kind === "open") openNoteCount += 1;
    else if (classification.kind === "modifier") modifierCount += 1;
    else otherNoteCount += 1;
  }

  const noteCount = Object.values(difficultyCounts).reduce((total, count) => total + count, 0);
  if (noteCount === 0) return null;

  const warnings: string[] = [];
  if (openNoteCount > 0) warnings.push(openNoteCount + " open notes will be skipped because this chart supports five numbered lanes.");
  if (modifierCount > 0) warnings.push(modifierCount + " force-HOPO/force-strum markers will be skipped; the editor does not model those modifiers.");
  if (otherNoteCount > 0) warnings.push(otherNoteCount + " other track markers or note types will be skipped.");
  if (normalizedTrackName(name) !== "PART GUITAR" && normalizedTrackName(name) !== "T1 GEMS") {
    warnings.push("This " + name + " part will be imported as a five-lane play chart; instrument-specific meaning is not retained.");
  }

  return {
    trackIndex,
    name: name || "Track " + (trackIndex + 1),
    noteCount,
    difficultyCounts,
    openNoteCount,
    modifierCount,
    otherNoteCount,
    warnings,
  };
}

function readTempoEvents(midi: Midi): { events: MidiTempoPreview[]; warnings: string[] } {
  const warnings: string[] = [];
  const ordered = [...midi.header.tempos].sort((left, right) => left.ticks - right.ticks);
  const events: MidiTempoPreview[] = [];

  for (const tempo of ordered) {
    if (
      !Number.isSafeInteger(tempo.ticks) || tempo.ticks < 0 ||
      !Number.isFinite(tempo.bpm) || tempo.bpm <= 0 ||
      !Number.isSafeInteger(Math.round(tempo.bpm * 1000))
    ) {
      throw new Error("The MIDI contains an invalid tempo marker that cannot be converted safely.");
    }
    const event = { tick: tempo.ticks, bpm: tempo.bpm };
    const previous = events[events.length - 1];
    if (previous?.tick === event.tick) {
      if (Math.round(previous.bpm * 1000) !== Math.round(event.bpm * 1000)) {
        throw new Error("The MIDI contains conflicting tempo changes at tick " + event.tick + ". Fix the tempo map before importing.");
      }
      continue;
    }
    events.push(event);
  }

  if (events.length === 0) {
    events.push({ tick: 0, bpm: 120 });
    warnings.push("No tempo was stored in the MIDI; 120 BPM was used at tick 0.");
  } else if (events[0].tick !== 0) {
    events.unshift({ tick: 0, bpm: 120 });
    warnings.push("The MIDI has no tempo at tick 0; 120 BPM was used until its first tempo marker.");
  }

  return { events, warnings };
}

function readTimeSignatures(midi: Midi): { events: MidiTimeSignaturePreview[]; warnings: string[] } {
  const warnings: string[] = [];
  const ordered = [...midi.header.timeSignatures].sort((left, right) => left.ticks - right.ticks);
  const events: MidiTimeSignaturePreview[] = [];

  for (const signature of ordered) {
    const [numerator, denominator] = signature.timeSignature;
    const exponent = Math.log2(denominator);
    if (
      !Number.isSafeInteger(signature.ticks) || signature.ticks < 0 ||
      !Number.isInteger(numerator) || numerator < 1 || numerator > 64 ||
      !Number.isInteger(exponent) || exponent < 0 || exponent > 10
    ) {
      throw new Error("The MIDI contains a time signature that .chart cannot represent safely.");
    }

    const event = { tick: signature.ticks, numerator, denominator };
    const previous = events[events.length - 1];
    if (previous?.tick === event.tick) {
      if (previous.numerator !== event.numerator || previous.denominator !== event.denominator) {
        throw new Error("The MIDI contains conflicting time signatures at tick " + event.tick + ". Fix the time-signature map before importing.");
      }
      continue;
    }
    events.push(event);
  }

  if (events.length === 0) {
    events.push({ tick: 0, numerator: 4, denominator: 4 });
    warnings.push("No time signature was stored in the MIDI; 4/4 was used.");
  } else if (events[0].tick !== 0) {
    events.unshift({ tick: 0, numerator: 4, denominator: 4 });
    warnings.push("The MIDI has no time signature at tick 0; 4/4 was used until its first time-signature marker.");
  }

  return { events, warnings };
}

function buildPreview(midi: Midi, midiFormat: 0 | 1): MidiChartPreview {
  const tempos = readTempoEvents(midi);
  const timeSignatures = readTimeSignatures(midi);
  const tracks = midi.tracks
    .map((track, index) => analyzeTrack(track, index))
    .filter((track): track is MidiTrackPreview => track !== null);
  if (tracks.length === 0) {
    throw new Error("No named five-lane guitar track was found. Supported names include PART GUITAR, PART BASS, and PART RHYTHM.");
  }

  return {
    midiFormat,
    ppq: midi.header.ppq,
    tempos: tempos.events,
    timeSignatures: timeSignatures.events,
    tracks,
    warnings: [...tempos.warnings, ...timeSignatures.warnings],
  };
}

export function inspectMidiChartSource(input: MidiSourceInput): MidiChartPreview {
  const { midi, midiFormat } = parseMidiSource(input);
  return buildPreview(midi, midiFormat);
}

function escapeChartString(value: string) {
  return value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function chartTitleFromFileName(fileName: string) {
  const title = fileName.split(/[\\/]/).pop()?.replace(/\.(mid|midi)$/i, "") ?? "Imported MIDI";
  return escapeChartString(title || "Imported MIDI");
}

function chartTick(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("The MIDI contains an invalid " + label + " tick.");
  }
  return value;
}

export function convertMidiTrackToChart(
  input: MidiSourceInput,
  fileName: string,
  trackIndex: number,
): MidiChartConversion {
  const { midi, midiFormat } = parseMidiSource(input);
  const preview = buildPreview(midi, midiFormat);
  const selectedPreview = preview.tracks.find((track) => track.trackIndex === trackIndex);
  const track = midi.tracks[trackIndex];
  if (!selectedPreview || !track) {
    throw new Error("Choose a supported five-lane track from the MIDI preview.");
  }

  const notesByDifficulty = new Map<ChartNoteDifficulty, Array<{ tick: number; lane: number; length: number }>>(
    DIFFICULTY_BASES.map(({ key }) => [key, []]),
  );
  for (const note of track.notes) {
    const classification = classifyPitch(note.midi);
    if (classification.kind !== "playable") continue;
    const tick = chartTick(note.ticks, "note");
    if (!Number.isFinite(note.durationTicks) || note.durationTicks < 0) {
      throw new Error("The MIDI contains a note with an invalid duration.");
    }
    const length = Math.max(0, Math.round(note.durationTicks));
    notesByDifficulty.get(classification.difficulty)?.push({ tick, lane: classification.lane, length });
  }

  const chartNotes = [...notesByDifficulty.entries()].flatMap(([difficulty, notes]) => {
    notes.sort((left, right) => left.tick - right.tick || left.lane - right.lane);
    return [
      "[" + difficulty + "]",
      "{",
      ...notes.map((note) => "  " + note.tick + " = N " + note.lane + " " + note.length),
      "}",
    ];
  });

  const tempoRows = preview.tempos.map((tempo) => ({
    tick: chartTick(tempo.tick, "tempo"),
    order: 1,
    line: "  " + tempo.tick + " = B " + Math.round(tempo.bpm * 1000),
  }));
  const timeSignatureRows = preview.timeSignatures.map((signature) => ({
    tick: chartTick(signature.tick, "time-signature"),
    order: 0,
    line: "  " + signature.tick + " = TS " + signature.numerator + " " + Math.log2(signature.denominator),
  }));
  const syncRows = [...timeSignatureRows, ...tempoRows]
    .sort((left, right) => left.tick - right.tick || left.order - right.order)
    .map((row) => row.line);
  const songTitle = chartTitleFromFileName(fileName);
  const chartText = [
    "[Song]",
    "{",
    "  Name = \"" + songTitle + "\"",
    "  Artist = \"\"",
    "  Resolution = " + preview.ppq,
    "  Offset = 0.000",
    "}",
    "[SyncTrack]",
    "{",
    ...syncRows,
    "}",
    ...chartNotes,
    "",
  ].join("\n");

  const warnings = [
    ...selectedPreview.warnings,
    ...preview.warnings,
    "MIDI has no .chart audio offset; the imported chart starts at 0.000 seconds. Calibrate it against the song before publishing.",
  ];
  return {
    chartText,
    fileName: fileName.replace(/\.(mid|midi)$/i, ".chart"),
    trackName: selectedPreview.name,
    noteCount: selectedPreview.noteCount,
    warnings,
  };
}
