export type SongFlowDebugEntry = {
  id: string;
  timestamp: string;
  stage: string;
  summary: string;
  payload?: unknown;
};

const storageKey = "ultrarapid_song_flow_debug";
const eventName = "ultrarapid-song-flow-debug";
const maxEntries = 200;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function buildEntry(stage: string, summary: string, payload?: unknown): SongFlowDebugEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    stage,
    summary,
    payload,
  };
}

export function getSongFlowDebugEntries(): SongFlowDebugEntry[] {
  if (!canUseBrowserStorage()) {
    return [];
  }

  const raw = window.sessionStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SongFlowDebugEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendSongFlowDebug(
  stage: string,
  summary: string,
  payload?: unknown,
) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const nextEntry = buildEntry(stage, summary, payload);
  const nextEntries = [...getSongFlowDebugEntries(), nextEntry].slice(-maxEntries);

  window.sessionStorage.setItem(storageKey, JSON.stringify(nextEntries));
  window.dispatchEvent(new CustomEvent(eventName, { detail: nextEntry }));
  console.info(`[song-flow-debug] ${stage}: ${summary}`, payload);
}

export function clearSongFlowDebugEntries() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(storageKey);
  window.dispatchEvent(new CustomEvent(eventName, { detail: null }));
}

export { eventName as songFlowDebugEventName };