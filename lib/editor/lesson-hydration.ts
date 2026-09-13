export type LessonHydrationRefs = {
  audioUrl: string;
  chartUrl: string;
  sidecarUrl: string | null;
};

export type LessonHydrationResult<TAudio, TChart, TSidecar> = {
  audio: TAudio;
  chart: TChart;
  sidecar: TSidecar;
  urls: LessonHydrationRefs;
  retried: boolean;
};

type HydrationError = Error & { status?: number };

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isRefreshableError(error: unknown) {
  if (isAbortError(error)) return false;
  const status = (error as HydrationError | null)?.status;
  // Supabase Storage reports an expired signed download token as HTTP 400.
  // Refresh remains bounded to one attempt and preserves the immutable
  // revision identity at the caller, so retrying this status cannot switch a
  // lesson to different content.
  if (status === 400 || status === 401 || status === 403 || status === 404) return true;
  return /\b(?:400|401|403|404)\b|expired|signature|signed url/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Lesson hydration was cancelled", "AbortError");
  }
}

async function fetchAll<TAudio, TChart, TSidecar>(
  urls: LessonHydrationRefs,
  options: {
    signal?: AbortSignal;
    fetchAudio: (url: string, signal?: AbortSignal) => Promise<TAudio>;
    fetchChart: (url: string, signal?: AbortSignal) => Promise<TChart>;
    fetchSidecar: (url: string, signal?: AbortSignal) => Promise<TSidecar>;
  },
): Promise<LessonHydrationResult<TAudio, TChart, TSidecar>> {
  throwIfAborted(options.signal);
  const [audio, chart, sidecar] = await Promise.allSettled([
    options.fetchAudio(urls.audioUrl, options.signal),
    options.fetchChart(urls.chartUrl, options.signal),
    options.fetchSidecar(urls.sidecarUrl ?? "", options.signal),
  ]);

  throwIfAborted(options.signal);
  const failed = [audio, chart, sidecar].find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed) throw failed.reason;
  if (audio.status !== "fulfilled" || chart.status !== "fulfilled" || sidecar.status !== "fulfilled") {
    throw new Error("Lesson hydration did not produce all required assets");
  }

  return {
    audio: audio.value,
    chart: chart.value,
    sidecar: sidecar.value,
    urls,
    retried: false,
  };
}

export async function loadLessonAssets<TAudio, TChart, TSidecar>(options: {
  refs: LessonHydrationRefs;
  signal?: AbortSignal;
  fetchAudio: (url: string, signal?: AbortSignal) => Promise<TAudio>;
  fetchChart: (url: string, signal?: AbortSignal) => Promise<TChart>;
  fetchSidecar: (url: string, signal?: AbortSignal) => Promise<TSidecar>;
  refresh?: () => Promise<LessonHydrationRefs | null>;
}): Promise<LessonHydrationResult<TAudio, TChart, TSidecar>> {
  try {
    return await fetchAll(options.refs, options);
  } catch (error) {
    throwIfAborted(options.signal);
    if (!options.refresh || !isRefreshableError(error)) throw error;

    const refreshed = await options.refresh();
    throwIfAborted(options.signal);
    if (!refreshed) throw error;

    const retried = await fetchAll(refreshed, options);
    return { ...retried, retried: true };
  }
}
