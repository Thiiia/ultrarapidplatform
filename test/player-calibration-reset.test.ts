import assert from "node:assert/strict";
import test from "node:test";

import {
  demoCalibrationStorageKey,
  resetPlayerCalibration,
} from "../lib/player-calibration-reset";

test("demo calibration reset removes only the current installation record locally", async () => {
  const removed: string[] = [];
  let apiCalled = false;

  await resetPlayerCalibration({
    isDemoMode: true,
    installationId: "device-1",
    storage: { removeItem: (key) => removed.push(key) },
    fetcher: async () => {
      apiCalled = true;
      return new Response(null, { status: 204 });
    },
  });

  assert.deepEqual(removed, [demoCalibrationStorageKey("device-1")]);
  assert.equal(apiCalled, false);
});

test("authenticated calibration reset sends a device-scoped DELETE", async () => {
  const calls: Array<{ input: RequestInfo | URL; method?: string }> = [];
  const removed: string[] = [];

  await resetPlayerCalibration({
    isDemoMode: false,
    installationId: "550e8400-e29b-41d4-a716-446655440000",
    storage: { removeItem: (key) => removed.push(key) },
    fetcher: async (input, init) => {
      calls.push({ input, method: init?.method });
      return new Response(null, { status: 204 });
    },
  });

  assert.deepEqual(calls, [{
    input: "/api/player-calibration?installationId=550e8400-e29b-41d4-a716-446655440000",
    method: "DELETE",
  }]);
  assert.deepEqual(removed, []);
});

test("calibration reset reports API failures to its caller", async () => {
  await assert.rejects(
    resetPlayerCalibration({
      isDemoMode: false,
      installationId: "550e8400-e29b-41d4-a716-446655440000",
      storage: { removeItem: () => undefined },
      fetcher: async () => new Response(null, { status: 500 }),
    }),
    /Calibration reset failed/,
  );
});
