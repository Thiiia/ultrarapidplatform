import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLessonPublishReadiness } from "../lib/guided-authored-encounter";
import {
  groupReadinessBlockers,
  paginateReadinessBlockers,
} from "../app/student/lesson-builder/readiness-blocker-list";

test("250 simultaneous Hits keep the readiness panel to 12 actionable rows per page", () => {
  const equation = { id: "eq", tokens: [{ id: "t", label: "5" }] };
  const events = Array.from({ length: 250 }, (_, index) => ({
    id: `event-${index}`,
    tick: 8,
    counts: { hit: 1, spin: 0, drag: 0 },
    assignments: { hit: equation },
    mechanicInstances: {
      hit: [{
        id: `hit-${index}`,
        tick: 8,
        endTick: 8,
        equation,
        hitBubbles: [{ tokenIndex: 0, targetId: "t", pads: ["left"] }],
        spinTargets: [],
        dragTargets: [],
      }],
      spin: [],
      drag: [],
    },
  }));

  const readiness = evaluateLessonPublishReadiness(events as never);
  assert.equal(readiness.blockers.length, 249);

  // Stress the renderer against the complete pair graph measured before the
  // readiness evaluator started deduplicating one conflict per affected cue.
  const densePairIssues = [];
  for (let rightIndex = 1; rightIndex < events.length; rightIndex += 1) {
    for (let leftIndex = 0; leftIndex < rightIndex; leftIndex += 1) {
      densePairIssues.push({
        encounterId: `hit-${rightIndex}`,
        relatedEncounterId: `hit-${leftIndex}`,
        code: "unsupported_concurrency" as const,
        message: `Move ${rightIndex} overlaps move ${leftIndex}.`,
        nextAction: `Move either move ${rightIndex} or move ${leftIndex} on the timeline.`,
      });
    }
  }
  assert.equal(densePairIssues.length, 31_125);

  const groups = groupReadinessBlockers(densePairIssues);
  assert.equal(groups.length, 249);
  assert.equal(groups[0].occurrences, 1);
  assert.equal(groups.at(-1)?.occurrences, 249);

  const firstPage = paginateReadinessBlockers(groups, 0);
  assert.equal(firstPage.blockers.length, 12);
  assert.equal(firstPage.pageCount, 21);
  assert.equal(firstPage.start, 1);
  assert.equal(firstPage.end, 12);
  assert.equal(firstPage.total, 249);

  const lastPage = paginateReadinessBlockers(groups, Number.POSITIVE_INFINITY);
  assert.equal(lastPage.page, 0);
  const finalPage = paginateReadinessBlockers(groups, 20);
  assert.equal(finalPage.blockers.length, 9);
  assert.equal(finalPage.start, 241);
  assert.equal(finalPage.end, 249);
});
