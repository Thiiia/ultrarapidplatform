import assert from "node:assert/strict";
import test from "node:test";
import { getEquationDraftIssue } from "../lib/editor/equation-draft-readiness";

const labels = (...values: string[]) => values.map((label) => ({ label }));

test("equations require one equals sign and terms on both sides", () => {
  assert.match(getEquationDraftIssue(labels("2", "+", "3")) ?? "", /= sign/);
  assert.match(getEquationDraftIssue(labels("2", "=", "=")) ?? "", /one =/);
  assert.match(getEquationDraftIssue(labels("2", "=")) ?? "", /both sides/);
  assert.match(getEquationDraftIssue(labels("2", "+", "=", "3")) ?? "", /Finish each side/);
  assert.match(getEquationDraftIssue(labels("+", "2", "=", "3")) ?? "", /Start each side/);
  assert.match(getEquationDraftIssue(labels("2", "+", "×", "3", "=", "4")) ?? "", /between operators/);
  assert.equal(getEquationDraftIssue(labels("2x", "+", "3", "=", "7")), null);
  assert.equal(getEquationDraftIssue(labels("2", "×", "(", "X", "+", "1", ")", "=", "6")), null);
  assert.match(getEquationDraftIssue(labels("2", "×", "(", "X", "=", "6")) ?? "", /Close open parentheses/);
});
