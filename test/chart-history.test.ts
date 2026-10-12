import assert from "node:assert/strict";
import test from "node:test";
import {
  CHART_HISTORY_LIMIT,
  createChartHistory,
  recordChartEdit,
  redoChartEdit,
  undoChartEdit,
} from "../lib/editor/chart-history";

test("chart history undoes and redoes edits in order", () => {
  let history = createChartHistory("initial");
  history = recordChartEdit(history, "first edit");
  history = recordChartEdit(history, "second edit");

  history = undoChartEdit(history);
  assert.equal(history.current, "first edit");
  history = undoChartEdit(history);
  assert.equal(history.current, "initial");

  history = redoChartEdit(history);
  assert.equal(history.current, "first edit");
  history = redoChartEdit(history);
  assert.equal(history.current, "second edit");
});

test("a new chart edit clears the redo branch", () => {
  let history = recordChartEdit(createChartHistory("initial"), "first edit");
  history = undoChartEdit(history);
  history = recordChartEdit(history, "replacement edit");

  assert.equal(history.current, "replacement edit");
  assert.deepEqual(history.future, []);
  assert.strictEqual(redoChartEdit(history), history);
});

test("chart history ignores no-op edits and caps retained snapshots", () => {
  const initial = createChartHistory("same");
  assert.strictEqual(recordChartEdit(initial, "same"), initial);

  let history = initial;
  for (let edit = 1; edit <= CHART_HISTORY_LIMIT + 5; edit += 1) {
    history = recordChartEdit(history, `edit ${edit}`);
  }

  assert.equal(history.past.length, CHART_HISTORY_LIMIT);
  assert.equal(history.current, `edit ${CHART_HISTORY_LIMIT + 5}`);
});
