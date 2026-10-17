import type { Case, Hypothesis } from "./types.js";

/** Ranking weights are never clinical probabilities without an explicit mode. */
export function probabilityMode(c: Case, h?: Hypothesis) {
  if (c.probabilityMode === "unavailable" || h?.probabilityMode === "unavailable") return "unavailable";
  return h?.probabilityMode ?? c.probabilityMode ?? "unavailable";
}

export function probabilityLabel(c: Case, h: Hypothesis): string {
  const mode = probabilityMode(c, h);
  if (mode === "unavailable") return "unquantified";
  return `${Math.round(h.probability * 100)}%${mode === "illustrative" ? " example" : ""}`;
}

export function probabilityExplanation(c: Case): string {
  if (probabilityMode(c) === "illustrative") return "Synthetic guided tour: percentages are illustrative teaching values, not validated patient probabilities.";
  if (probabilityMode(c) === "computed") return "Probabilities use the recorded quantitative model. Review its inputs and applicability before use.";
  return "Clinical probabilities are unavailable. Hypothesis order and bar lengths show relative model ranking, not calibrated risk.";
}
