type Row = Record<string, unknown>;

import { parseAuthoredLessonDraft } from "./authored-lesson";
import { isLegacyEncounterSidecar, validateLegacyEncounters } from "./legacy-encounters";

/** Companion ticks use chart coordinates and may lie between rhythm note ticks. */
export function validateLessonContent(chart: string, json: string, options: { forSave?: boolean } = {}) {
  const section = (name: string) => chart.match(new RegExp(`\\[${name}\\]\\s*\\{([\\s\\S]*?)\\}`))?.[1];
  if (!section('Song') || !section('SyncTrack') || !/Resolution\s*=\s*"?[1-9]\d*/.test(section('Song')!)) {
    throw new Error('Invalid chart: Song, positive Resolution and SyncTrack are required');
  }
  if (!/\b0\s*=\s*B\s+[1-9]\d*/.test(section('SyncTrack')!)) throw new Error('Invalid chart BPM at tick zero');
  const payload = JSON.parse(json) as Row;
  if (!payload || ![1, 2, 3].includes(Number(payload.version))) throw new Error('Unsupported companion version');
  if (Number(payload.version) === 3) {
    parseAuthoredLessonDraft(payload);
    return;
  }
  const difficulties = ['EasySingle','MediumSingle','HardSingle','ExpertSingle'].map(section).filter(Boolean);
  if (!options.forSave && !difficulties.some(body => /^\s*\d+\s*=\s*N\s+\d+\s+\d+/m.test(body!))) throw new Error('Invalid chart: no playable notes');
  for (const body of difficulties) {
    let previous = -1;
    for (const match of body!.matchAll(/^\s*(\d+)\s*=\s*N\s+\d+\s+\d+/gm)) {
      const tick = Number(match[1]);
      if (tick < previous) throw new Error('Invalid chart: note ticks must be ordered');
      previous = tick;
    }
  }
  if (isLegacyEncounterSidecar(payload)) {
    validateLegacyEncounters(payload);
    // A legacy document may also contain newly edited event rows.
    if (payload.events === undefined) return;
  }
  const rows = payload.version === 2 ? payload.equations : payload.events;
  // Saving may persist an empty editor timeline (including deleting its last
  // encounter). Gameplay readiness must not prevent saving that authored state.
  // Missing or malformed collections still indicate an invalid payload.
  if (!Array.isArray(rows)) throw new Error('Companion encounter collection must be an array');
  const identities = new Set<string>();
  const actions = new Map<number, Set<string>>();
  let previous = -1;
  for (const value of rows) {
    if (!value || typeof value !== 'object') throw new Error('Invalid companion encounter');
    const row = value as Row;
    if (!Number.isSafeInteger(row.tick) || Number(row.tick) < 0) throw new Error('Invalid companion tick');
    const tick = Number(row.tick);
    if (tick < previous) throw new Error('Companion ticks must be ordered');
    previous = tick;
    if (payload.version === 2) {
      const identity = String(row.id ?? row.equationId ?? tick);
      if (identities.has(identity)) throw new Error('Duplicate encounter identity');
      identities.add(identity);
      if (!row.state && !row.equationId && !row.id) throw new Error('Encounter equation is missing');
    }
    if (typeof row.state === 'string' && (!row.state.trim() || !row.state.includes('='))) throw new Error('Invalid equation state');
    const tickActions = actions.get(tick) ?? new Set<string>();
    for (const action of ['hit','spin','drag']) {
      const array = row[`${action}s`];
      const counts = row.counts as Row | undefined;
      const count = counts?.[action] ?? counts?.[`${action}s`];
      if (Array.isArray(array) && count !== undefined && count !== array.length) throw new Error('Companion action counts disagree');
      if ((Array.isArray(array) && array.length) || Number(count) > 0 || row.mechanic === action) tickActions.add(action);
    }
    if (!options.forSave && tickActions.has('spin') && tickActions.has('drag')) throw new Error(`Unsupported spin and drag collision at tick ${tick}`);
    actions.set(tick, tickActions);
  }
}
