// Types shared between pipeline steps. Not part of the public interface.

export interface DiagnosisHint {
  id: string;
  name: string;
  searchTerm: string;
}

export interface FindingHint {
  id: string;
  name: string;
  searchTerm: string;
  quotedFrom: string;
  /** "absent" for negated findings such as "no cough". */
  presence: "present" | "absent";
}

export type QuestionKind = "prior" | "lr";

export interface Question {
  id: string;
  kind: QuestionKind;
  text: string;
  diagnosis: DiagnosisHint;
  finding?: FindingHint;
  ageBand: string | null;
}

export const NUMBER_FIELDS = {
  prior: ["value"],
  lr: ["lrPositive", "lrNegative", "sensitivity", "specificity"],
} as const;

export type NumberField = "value" | "lrPositive" | "lrNegative" | "sensitivity" | "specificity";

/** One answer the checker model proposes. Untrusted until verified. */
export interface CheckerFinding {
  sourceId: string;
  quote: string;
  stance: "supports" | "contradicts";
  numbers: Partial<Record<NumberField, number | null>> & { ci95?: [number, number] | null };
  population: string | null;
  setting: string | null;
  denominator: string | null;
  reason: string;
  limitations: string[];
}

export interface VerifiedFinding extends CheckerFinding {
  /** Discrepancies found by code, e.g. a number that is not in the quote. */
  notes: string[];
  doubleCheck: "agreed" | "disagreed" | "skipped";
}
