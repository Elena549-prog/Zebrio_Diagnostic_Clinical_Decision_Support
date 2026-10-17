import { test } from "node:test";
import assert from "node:assert/strict";
import { TUTORIAL_STEPS } from "./tutorialCase.js";
import { evidenceRelation } from "./evidenceLinks.js";

test("attribution follows stored links without changing the case", () => {
  const c = structuredClone(TUTORIAL_STEPS[1]!.case);
  const h = Object.values(c.hypotheses).find((item) => item.evidenceFor.length)!;
  const findingId = h.evidenceFor[0]!.findingId;
  const before = structuredClone(c);
  assert.equal(evidenceRelation(c, h.id, findingId), "supports");
  assert.equal(evidenceRelation(c, "missing", findingId), null);
  assert.equal(evidenceRelation(c, h.id, "missing"), null);
  assert.deepEqual(c, before);
});

test("unlinked observations are not turned into support; conflicting links stay mixed", () => {
  const c = structuredClone(TUTORIAL_STEPS[1]!.case);
  const h = Object.values(c.hypotheses).find((item) => item.evidenceFor.length)!;
  const findingId = h.evidenceFor[0]!.findingId;
  h.evidenceAgainst.push({ findingId, weight: "Recorded contrary link" });
  assert.equal(evidenceRelation(c, h.id, findingId), "mixed");
  const f = c.findings.find((item) => item.id === findingId)!;
  h.evidenceFor = []; h.evidenceAgainst = []; f.hypothesisIds = []; f.direction = "supports";
  assert.equal(evidenceRelation(c, h.id, findingId), null);
  f.hypothesisIds = [h.id]; f.direction = "against";
  assert.equal(evidenceRelation(c, h.id, findingId), "against");
});

test("historical snapshots cannot see later finding links", () => {
  const past = structuredClone(TUTORIAL_STEPS[1]!.case);
  const future = TUTORIAL_STEPS[3]!.case;
  const laterFinding = future.findings.find((finding) => !past.findings.some((item) => item.id === finding.id))!;
  assert.ok(laterFinding);
  for (const h of Object.values(past.hypotheses)) assert.equal(evidenceRelation(past, h.id, laterFinding.id), null);
});
