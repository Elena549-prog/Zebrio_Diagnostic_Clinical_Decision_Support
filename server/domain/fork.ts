import type { Case } from './types.js';
import { appendEvent, newId } from './case-store.js';
import { capture } from './history.js';
import { unavailableProbability } from './probability.js';

/** Copy the selected server snapshot. Never consult the parent's future state. */
export function forkCase(parent: Case, frameSeq: number): Case {
  const index = parent.history.findIndex((entry) => entry.seq === frameSeq);
  const frame = parent.history[index];
  if (!Number.isSafeInteger(frameSeq) || !frame) throw new RangeError('Select a valid timeline step.');
  const now = new Date().toISOString();
  const testGate = frame.awaitingHitl && !frame.pendingDiagnosis && !frame.workingDiagnosis && !frame.treatmentPlan;
  const c: Case = {
    id: newId('case'),
    title: `What-if: ${parent.title.replace(/^What-if: /, '')}`.slice(0, 160),
    forkOrigin: { parentCaseId: parent.id, parentTitle: parent.title, parentFrameSeq: frame.seq, parentFrameLabel: frame.label, forkedAt: now },
    presentation: structuredClone(parent.presentation),
    status: Object.keys(frame.hypotheses).length ? 'reasoning' : 'intake',
    hypotheses: structuredClone(frame.hypotheses),
    rootHypothesisIds: [...frame.rootHypothesisIds],
    findings: structuredClone(frame.findings),
    sources: structuredClone(frame.sources),
    tests: structuredClone(frame.tests),
    events: structuredClone(parent.events.slice(0, frame.eventCount)),
    history: structuredClone(parent.history.slice(0, index + 1)),
    round: frame.round,
    probabilityMode: 'unavailable',
    probabilityCalculation: unavailableProbability('What-if exploration. No reviewed clinical probability model is configured.'),
    awaitingHitl: testGate,
    hitlPrompt: testGate ? frame.hitlPrompt : undefined,
    createdAt: now,
    updatedAt: now,
  };
  for (const hypothesis of Object.values(c.hypotheses)) {
    if (hypothesis.status === 'confirmed') hypothesis.status = 'live';
    hypothesis.probabilityMode = 'unavailable';
  }
  appendEvent(c, {
    round: c.round, kind: 'engine_message',
    summary: `What-if exploration forked after “${frame.label}”. Diagnosis confirmation and treatment are cleared for reconsideration. New manual findings are hypothetical; the original case is unchanged.`,
    payload: c.forkOrigin,
  });
  capture(c, 'fork', `Fork: ${frame.label}`);
  return c;
}
