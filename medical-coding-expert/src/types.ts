// Public contract between Person 2 (coding) and Person 3 (orchestration).
// See docs/person2/SPEC.md -> "Deliverable and interface".

export interface Excerpt {
  id: string;
  text: string;
}

export interface Evidence {
  id: string;
  text: string;
  kind: "patient_finding" | "literature";
  sourceUrl?: string;
}

export interface Hypothesis {
  id: string;
  name: string;
}

export interface CodingRequest {
  requestId: string;
  excerpts: Excerpt[];
  evidence: Evidence[];
  /** Hints from the orchestrator, never treated as confirmed diagnoses. */
  hypotheses?: Hypothesis[];
}

export type ResultStatus =
  | "assigned"
  | "needs_clarification"
  | "no_supported_code"
  | "unavailable";

/** How the condition is mentioned in the supplied material. */
export const ASSERTIONS = ["documented", "suspected", "negated", "historical", "family_history", "literature_only"] as const;
export type Assertion = (typeof ASSERTIONS)[number];

export type RetrievalProvider = "tavily" | "direct";
export type SearchProvider = "tavily" | "duckduckgo";
export type EntryKind = "category" | "terminal" | "unknown";

export interface Reference {
  url: string;
  supportingPassage: string;
  retrievedAt: string;
  retrievalProvider: RetrievalProvider;
}

export interface Candidate {
  code: string;
  officialLabel: string;
  entryKind: EntryKind;
  reference: Reference;
}

export interface CodingResult {
  condition: string;
  hypothesisId?: string;
  assertion: Assertion;
  status: ResultStatus;
  code: string | null;
  officialLabel: string | null;
  rationale: string;
  inputRefs: string[];
  references: Reference[];
  clarificationQuestions: string[];
  candidates?: Candidate[];
}

export interface CodingResponse {
  requestId: string;
  system: "ICD-10-GM";
  edition: "2026";
  results: CodingResult[];
  searchProvidersUsed: SearchProvider[];
  limitations: string[];
}
