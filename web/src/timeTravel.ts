/**
 * Time travel — reading the case's history tape.
 *
 * The server stores a complete case state per step (see server/domain/history.ts),
 * so "show me round 2" is a projection, not a replay: we rebuild a Case-shaped
 * object from the frame and hand it to the same panels that render the present.
 * Every view — tree, ranked list, evidence, detail — then travels for free.
 *
 * The frame is the source of truth for everything that changes; the identity
 * fields (id, title, presentation) are taken from the live case because they
 * don't.
 */

import type { Case, HistoryEntry, Hypothesis } from "./types.js";

/** Rebuild the case as it stood at the end of `frame`. */
export function caseAtFrame(c: Case, frame: HistoryEntry): Case {
  return {
    ...c,
    status: frame.status,
    probabilityMode: frame.probabilityMode ?? c.probabilityMode,
    probabilityCalculation: frame.probabilityCalculation,
    pendingDiagnosis: frame.pendingDiagnosis,
    hypotheses: frame.hypotheses,
    rootHypothesisIds: frame.rootHypothesisIds,
    findings: frame.findings,
    sources: frame.sources,
    tests: frame.tests,
    workingDiagnosis: frame.workingDiagnosis,
    treatmentPlan: frame.treatmentPlan,
    round: frame.round,
    awaitingHitl: frame.awaitingHitl,
    hitlPrompt: frame.hitlPrompt,
    // Trim narration to what had been said by this point, so the event log and
    // the state on screen agree.
    events: c.events.slice(0, frame.eventCount),
    updatedAt: frame.at,
  };
}

export interface HypothesisDelta {
  /** Appeared on the tree in this step. */
  added: boolean;
  /** Probability change since the previous frame, or null if it's new. */
  delta: number | null;
  /** Status changed in this step (e.g. live -> ruled_out). */
  statusFrom?: Hypothesis["status"];
}

export interface FrameDiff {
  byHypothesis: Record<string, HypothesisDelta>;
  addedCount: number;
  ruledOutCount: number;
  newFindings: number;
  newSources: number;
  newTests: number;
  /** A test moved to resulted/ordered in this step. */
  testsResolved: number;
  /** The working diagnosis or treatment plan first appeared here. */
  concluded?: "diagnosis" | "treatment";
  /** True for the first frame, which has nothing to compare against. */
  isFirst: boolean;
}

const EMPTY_DIFF: FrameDiff = {
  byHypothesis: {},
  addedCount: 0,
  ruledOutCount: 0,
  newFindings: 0,
  newSources: 0,
  newTests: 0,
  testsResolved: 0,
  isFirst: true,
};

/**
 * What changed between two adjacent frames. This is the part that answers
 * "what led us here" — a frame on its own is a state, but the delta is the
 * reasoning step.
 */
export function diffFrames(prev: HistoryEntry | undefined, cur: HistoryEntry): FrameDiff {
  if (!prev) return EMPTY_DIFF;
  const byHypothesis: Record<string, HypothesisDelta> = {};
  let addedCount = 0;
  let ruledOutCount = 0;
  for (const [id, h] of Object.entries(cur.hypotheses)) {
    const before = prev.hypotheses[id];
    if (!before) {
      byHypothesis[id] = { added: true, delta: null };
      addedCount++;
      continue;
    }
    const delta = h.probability - before.probability;
    const statusChanged = before.status !== h.status;
    if (statusChanged && h.status === "ruled_out") ruledOutCount++;
    // Ignore probability noise below a percentage point — it isn't a step the
    // clinician needs to see.
    if (Math.abs(delta) >= 0.01 || statusChanged) {
      byHypothesis[id] = {
        added: false,
        delta,
        statusFrom: statusChanged ? before.status : undefined,
      };
    }
  }
  return {
    byHypothesis,
    addedCount,
    ruledOutCount,
    newFindings: cur.findings.length - prev.findings.length,
    newSources: cur.sources.length - prev.sources.length,
    newTests: cur.tests.length - prev.tests.length,
    testsResolved: countResolved(prev, cur),
    concluded:
      !prev.treatmentPlan && cur.treatmentPlan
        ? "treatment"
        : !prev.workingDiagnosis && cur.workingDiagnosis
          ? "diagnosis"
          : undefined,
    isFirst: false,
  };
}

/** Tests whose status advanced (proposed -> ordered -> resulted) in this step. */
function countResolved(prev: HistoryEntry, cur: HistoryEntry): number {
  const before = new Map(prev.tests.map((t) => [t.id, t.status]));
  let n = 0;
  for (const t of cur.tests) {
    const was = before.get(t.id);
    if (was && was !== t.status) n++;
  }
  return n;
}

/** One-line description of a step, for the scrubber's tooltip and caption. */
export function describeDiff(d: FrameDiff): string {
  if (d.isFirst) return "The case as presented";
  const bits: string[] = [];
  if (d.addedCount) bits.push(`${d.addedCount} new hypothes${d.addedCount === 1 ? "is" : "es"}`);
  if (d.ruledOutCount) bits.push(`${d.ruledOutCount} ruled out`);
  const moved = Object.values(d.byHypothesis).filter((x) => !x.added && x.delta !== null).length;
  if (moved) bits.push(`${moved} re-weighted`);
  if (d.newFindings > 0) bits.push(`${d.newFindings} finding${d.newFindings === 1 ? "" : "s"}`);
  if (d.newTests > 0) bits.push(`${d.newTests} test${d.newTests === 1 ? "" : "s"} proposed`);
  if (d.testsResolved > 0) bits.push(`${d.testsResolved} test result${d.testsResolved === 1 ? "" : "s"}`);
  if (d.newSources > 0) bits.push(`${d.newSources} source${d.newSources === 1 ? "" : "s"}`);
  if (d.concluded === "diagnosis") bits.push("working diagnosis set");
  if (d.concluded === "treatment") bits.push("treatment plan built");
  return bits.length ? bits.join(" · ") : "No change to the differential";
}
