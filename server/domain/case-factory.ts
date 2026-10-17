/**
 * Case factory — create a new diagnostic Case from a presentation.
 */

import { appendEvent, newId, store } from "./case-store.js";
import { capture } from "./history.js";
import type { Case, Presentation } from "./types.js";

export function createCase(presentation: Presentation, title?: string): Case {
  const now = new Date().toISOString();
  const id = newId("case");
  const c: Case = {
    id,
    title:
      title ||
      `${presentation.chiefComplaint.slice(0, 48)}${presentation.chiefComplaint.length > 48 ? "…" : ""}`,
    status: "intake",
    probabilityMode: "unavailable",
    probabilityCalculation: { status: "unavailable", reason: "No reviewed clinical probability model is configured." },
    presentation,
    hypotheses: {},
    rootHypothesisIds: [],
    findings: [],
    sources: [],
    tests: [],
    events: [],
    round: 0,
    awaitingHitl: false,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  appendEvent(c, {
    round: 0,
    kind: "presentation",
    summary: `Intake: ${presentation.chiefComplaint}`,
    payload: presentation,
  });
  // Frame 0 of the tape: the case as presented, before any reasoning.
  capture(c, "intake", "Intake");
  store.create(c);
  return c;
}
