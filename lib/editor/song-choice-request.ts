export const SONG_CHOICE_REQUEST_TIMEOUT_MS = 15_000;
export const SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE =
  "Loading is taking longer than expected. Check your connection and try again.";

type FetchJsonWithTimeoutOptions = Omit<RequestInit, "signal"> & {
  timeoutMs?: number;
  signal?: AbortSignal | null;
  fetchImplementation?: typeof fetch;
};

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  options: FetchJsonWithTimeoutOptions = {},
): Promise<{ response: Response; payload: T | null }> {
  const {
    timeoutMs = SONG_CHOICE_REQUEST_TIMEOUT_MS,
    fetchImplementation = globalThis.fetch,
    signal: callerSignal,
    ...requestOptions
  } = options;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number");
  }

  const requestController = new AbortController();
  let callerAbortHandler: (() => void) | undefined;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  const callerAbortPromise = callerSignal
    ? new Promise<never>((_resolve, reject) => {
      callerAbortHandler = () => {
        const reason = callerSignal.reason ?? new DOMException("Request aborted", "AbortError");
        requestController.abort(reason);
        reject(reason);
      };

      if (callerSignal.aborted) {
        callerAbortHandler();
      } else {
        callerSignal.addEventListener("abort", callerAbortHandler, { once: true });
      }
    })
    : null;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      requestController.abort();
      reject(new Error(SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE));
    }, timeoutMs);
  });

  const requestPromise = Promise.resolve().then(async () => {
    const response = await fetchImplementation(input, {
      ...requestOptions,
      signal: requestController.signal,
    });
    const payload = await response.json().catch((error: unknown) => {
      if (requestController.signal.aborted) throw error;
      return null;
    }) as T | null;

    if (requestController.signal.aborted && !callerSignal?.aborted) {
      throw new Error(SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE);
    }

    return { response, payload };
  });

  const pending: Promise<{ response: Response; payload: T | null }>[] = [
    requestPromise,
    timeoutPromise,
  ];
  if (callerAbortPromise) pending.push(callerAbortPromise);

  try {
    return await Promise.race(pending);
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    if (requestController.signal.aborted) {
      throw new Error(SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    if (callerSignal && callerAbortHandler) {
      callerSignal.removeEventListener("abort", callerAbortHandler);
    }
  }
}
