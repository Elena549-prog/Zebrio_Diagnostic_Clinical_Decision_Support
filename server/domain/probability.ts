import type { ProbabilityAssessment } from "./types.js";

/** Pure arithmetic only. Clinical applicability is a separate model decision. */
export function binaryBayes(prior: number, likelihoodRatio: number): number {
  if (!Number.isFinite(prior) || prior < 0 || prior > 1) {
    throw new RangeError("Prior must be a finite probability between zero and one.");
  }
  if (!Number.isFinite(likelihoodRatio) || likelihoodRatio < 0) {
    throw new RangeError("Likelihood ratio must be finite and non-negative.");
  }
  if (prior === 1 && likelihoodRatio === 0) {
    throw new RangeError("The observation is impossible under the supplied prior/model.");
  }
  if (prior === 0 || likelihoodRatio === 0) return 0;
  if (prior === 1) return 1;
  // Log odds avoid overflow with large but finite likelihood ratios.
  const logOdds = Math.log(prior) - Math.log1p(-prior) + Math.log(likelihoodRatio);
  return logOdds >= 0 ? 1 / (1 + Math.exp(-logOdds)) : Math.exp(logOdds) / (1 + Math.exp(logOdds));
}

export function unavailableProbability(
  reason = "No reviewed clinical probability model is configured. Relative differential rank is not a patient probability.",
): ProbabilityAssessment {
  return { status: "unavailable", reason };
}

/** Explicitly synthetic: this result must never be promoted to a live clinical estimate. */
export function illustrateBinaryBayes(prior: number, likelihoodRatio: number): ProbabilityAssessment {
  return {
    status: "computed", mode: "illustrative", value: binaryBayes(prior, likelihoodRatio),
    prior, likelihoodRatio, modelId: "synthetic-binary-bayes", modelVersion: "1",
  };
}
