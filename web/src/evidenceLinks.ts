import type { Case } from "./types.js";

export type EvidenceRelation = "supports" | "against" | "neutral" | "mixed";

/** Trace stored links only; these are not model attribution scores. */
export function evidenceRelation(c: Case, hypothesisId: string, findingId: string): EvidenceRelation | null {
  const hypothesis = c.hypotheses[hypothesisId];
  const finding = c.findings.find((item) => item.id === findingId);
  if (!hypothesis || !finding) return null;
  const supports = hypothesis.evidenceFor.some((item) => item.findingId === findingId);
  const against = hypothesis.evidenceAgainst.some((item) => item.findingId === findingId);
  if (supports && against) return "mixed";
  if (supports) return "supports";
  if (against) return "against";
  return finding.hypothesisIds.includes(hypothesisId) ? finding.direction : null;
}
