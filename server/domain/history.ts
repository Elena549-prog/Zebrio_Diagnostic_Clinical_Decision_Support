/**
 * Case history — the substrate for time travel.
 *
 * A Case only ever holds its *current* state: `hypotheses` is a map mutated in
 * place, so once round 3 has run there is no record of what the differential
 * looked like at round 2. Reconstructing that from the event log is not
 * possible — events carry summaries, not probabilities.
 *
 * So we snapshot. After every step that changes the reasoning state we deep-copy
 * the mutable slice of the case and append it to `c.history`. The result is an
 * append-only tape the UI can scrub across: each entry is a complete, renderable
 * case state, so "show me round 2" is a lookup rather than a replay.
 *
 * A step, not a round, is the unit. A clinician entering a test result between
 * rounds changes the picture as much as a round does, and "what led us here"
 * reads wrong if those moments are missing. Every entry still carries its round
 * number, so the UI can label and group by round.
 *
 * Cost: one deep copy of the hypothesis map per step. At the demo's scale (tens
 * of rounds, tens of hypotheses) this is kilobytes. A deployment that expected
 * hundreds of rounds would want structural sharing or a diff log instead.
 */

import type { Case, HistoryEntry, HistoryKind } from "./types.js";

/**
 * Append a snapshot of the case's current reasoning state.
 *
 * Called *after* the step's mutations have landed, so the entry represents the
 * world as it stood at the end of that step.
 */
export function capture(c: Case, kind: HistoryKind, label: string): HistoryEntry {
  const entry: HistoryEntry = {
    seq: c.history.length,
    round: c.round,
    kind,
    label,
    at: new Date().toISOString(),
    status: c.status,
    probabilityMode: c.probabilityMode,
    probabilityCalculation: c.probabilityCalculation ? structuredClone(c.probabilityCalculation) : undefined,
    pendingDiagnosis: c.pendingDiagnosis ? structuredClone(c.pendingDiagnosis) : undefined,
    // Deep copies: the live case keeps mutating these in place.
    hypotheses: structuredClone(c.hypotheses),
    rootHypothesisIds: [...c.rootHypothesisIds],
    findings: structuredClone(c.findings),
    sources: structuredClone(c.sources),
    tests: structuredClone(c.tests),
    workingDiagnosis: c.workingDiagnosis ? structuredClone(c.workingDiagnosis) : undefined,
    treatmentPlan: c.treatmentPlan ? structuredClone(c.treatmentPlan) : undefined,
    awaitingHitl: c.awaitingHitl,
    hitlPrompt: c.hitlPrompt,
    // How far the event log had got. Scrubbing back trims the log to here so
    // the narration matches the state being shown.
    eventCount: c.events.length,
  };
  c.history.push(entry);
  return entry;
}
