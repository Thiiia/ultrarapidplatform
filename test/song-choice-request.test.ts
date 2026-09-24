import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchJsonWithTimeout,
  SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE,
} from "../lib/editor/song-choice-request.ts";

test("a stalled song-choice request aborts at its deadline with retry guidance", async () => {
  let observedSignal: AbortSignal | undefined;
  const fetchImplementation: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      observedSignal = init?.signal as AbortSignal;
      observedSignal.addEventListener(
        "abort",
        () => reject(new DOMException("Request aborted", "AbortError")),
        { once: true },
      );
    });

  await assert.rejects(
    () => fetchJsonWithTimeout("/api/song-choice", { timeoutMs: 5, fetchImplementation }),
    (error: unknown) =>
      error instanceof Error && error.message === SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE,
  );

  assert.equal(observedSignal?.aborted, true);
});

test("a completed song-choice request clears its timeout", async () => {
  let observedSignal: AbortSignal | undefined;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    observedSignal = init?.signal as AbortSignal;
    return new Response(JSON.stringify({ songs: [] }));
  };

  const result = await fetchJsonWithTimeout<{ songs: unknown[] }>("/api/song-choice", {
    timeoutMs: 10,
    fetchImplementation,
  });

  assert.deepEqual(result.payload, { songs: [] });
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  assert.equal(observedSignal?.aborted, false);
});

test("the request deadline includes a response body that never finishes", async () => {
  let observedSignal: AbortSignal | undefined;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    observedSignal = init?.signal as AbortSignal;
    const response = new Response();
    Object.defineProperty(response, "json", {
      value: () => new Promise<never>((_resolve, reject) => {
        observedSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request aborted", "AbortError")),
          { once: true },
        );
      }),
    });
    return response;
  };

  await assert.rejects(
    () => fetchJsonWithTimeout("/api/song-choice", { timeoutMs: 5, fetchImplementation }),
    (error: unknown) =>
      error instanceof Error && error.message === SONG_CHOICE_REQUEST_TIMEOUT_MESSAGE,
  );

  assert.equal(observedSignal?.aborted, true);
});

test("caller cancellation remains distinguishable from a request timeout", async () => {
  const callerController = new AbortController();
  const fetchImplementation: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      (init?.signal as AbortSignal).addEventListener(
        "abort",
        () => reject(new DOMException("Request aborted", "AbortError")),
        { once: true },
      );
    });

  const request = fetchJsonWithTimeout("/api/song-choice", {
    signal: callerController.signal,
    timeoutMs: 1_000,
    fetchImplementation,
  });
  callerController.abort();

  await assert.rejects(request, { name: "AbortError" });
});
