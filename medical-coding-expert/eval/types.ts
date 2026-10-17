// Shape of eval/cases/*.json. Codes are compared after normalization
// (upper case, trailing "-"/"!" dropped); "forbidden" lists match by prefix,
// so "I26" forbids I26.0 and I26.9.

import type { Assertion, CodingRequest, ResultStatus } from "../src/types.ts";

export interface ExpectedResult {
  id: string;
  /** Missing optional results are reported but do not fail the case. Default true. */
  required?: boolean;
  /** Finds the result for this expectation; every given criterion adds to the match score. */
  match: { hypothesisId?: string; conditionIncludes?: string[]; inputRefs?: string[] };
  assertion: Assertion[];
  status: ResultStatus[];
  /** When the status is "assigned", the code must be one of these (exact). */
  acceptableCodes?: string[];
  /** Best possible answer; when missed but still acceptable, the report notes it. */
  idealCode?: string;
  /** For needs_clarification: at least one candidate should be one of these. */
  candidateCodes?: string[];
  /** Assigning any of these (prefix) fails the case. */
  forbiddenCodes?: string[];
  requiredInputRefs?: string[];
  /** Why this is the right answer, with the BfArM wording. */
  notes: string;
}

export interface EvalCase {
  id: string;
  title: string;
  language: "de" | "en" | "mixed";
  source: "synthetic" | "teaching-style";
  sourceNote: string;
  tests: string[];
  request: CodingRequest;
  expected: ExpectedResult[];
  /** Extra assigned codes (not matched to an expectation) that are fine. */
  allowedExtraCodes?: string[];
  allowedExtraCodePrefixes?: string[];
  forbiddenAssignedCodes?: string[];
  forbiddenCandidateCodes?: string[];
  /** Patient identifiers that must never appear in a web search query. */
  forbiddenQueryTerms?: string[];
  maxAssigned?: number;
}

export interface Match {
  expectedId: string;
  resultIndex: number | null;
}

export interface CaseScore {
  caseId: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
  notes: string[];
  matches: Match[];
}
