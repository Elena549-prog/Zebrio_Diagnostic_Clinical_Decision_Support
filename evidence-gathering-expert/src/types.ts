// Public interface of the Evidence Gathering Expert. See SPEC.md "Interface".

export interface Presentation {
  chiefComplaint: string;
  history?: string;
  observations?: string[];
  demographics?: {
    ageYears?: number;
    sex?: string;
    location?: string;
    raceEthnicity?: string;
    comorbidities?: string[];
  };
}

export interface EvidenceRequest {
  requestId?: string;
  presentation: Presentation;
}

export type ItemStatus = "supported" | "contradicted" | "conflicting" | "insufficient" | "inaccessible";

export type AccessLevel = "full_text" | "abstract_only" | "snippet_only" | "paywalled" | "inaccessible";

export type StudyType =
  | "guideline"
  | "systematic-review"
  | "meta-analysis"
  | "rct"
  | "observational"
  | "other";

export type Provider = "europepmc" | "pubmed" | "duckduckgo";

export interface Source {
  id: string;
  url: string;
  doiUrl?: string;
  title: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  studyType: StudyType;
  year?: number;
  accessLevel: AccessLevel;
  retrievedAt: string;
  provider: Provider;
}

/** A source plus the text we actually retrieved. The text never leaves the module. */
export interface StoredSource extends Source {
  text: string;
}

export interface Evidence {
  id: string;
  sourceId: string;
  url: string;
  passage: string;
  doubleCheck: "agreed" | "disagreed" | "skipped";
  reason: string;
  limitations: string[];
  stance: "supports" | "contradicts";
  kind: "literature";
}

interface Context {
  population: string | null;
  setting: string | null;
  denominator: string | null;
  ci95: [number, number] | null;
  missing: string[];
  evidenceIds: string[];
  status: ItemStatus;
  /** Why the status is what it is; carries discrepancies and disagreements. */
  note?: string;
}

export interface PriorItem extends Context {
  question: string;
  value: number | null;
  unit: "proportion";
}

export interface LikelihoodRatioItem extends Context {
  question: string;
  finding: string;
  quotedFrom: string;
  lrPositive: number | null;
  lrNegative: number | null;
  sensitivity: number | null;
  specificity: number | null;
}

export interface DiagnosisResult {
  id: string;
  diagnosis: string;
  origin: "suggested_by_model";
  prior: PriorItem;
  likelihoodRatios: LikelihoodRatioItem[];
}

export interface PatientFinding {
  id: string;
  text: string;
  quotedFrom: string;
  kind: "patient_finding";
}

export interface ErrorEntry {
  step: "screen" | "analyse" | "retrieve" | "check" | "double-check" | "budget";
  question?: string;
  message: string;
}

export interface EvidenceResponse {
  requestId: string;
  status: "complete" | "partial" | "failed";
  generatedAt: string;
  diagnoses: DiagnosisResult[];
  evidence: Evidence[];
  patientFindings: PatientFinding[];
  sources: Source[];
  errors: ErrorEntry[];
  limitations: string[];
}

// ---- Dependencies (injected so tests need no keys and no network) ----

export type LlmTask = "analyse" | "check" | "double-check";

export interface LlmRequest {
  task: LlmTask;
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export interface LlmClient {
  /** Returns the model's JSON text. Throws on API failure. */
  complete(req: LlmRequest): Promise<string>;
}

export interface Config {
  maxDiagnoses: number;
  maxFindingsPerDiagnosis: number;
  maxSourcesPerQuestion: number;
  concurrency: number;
  httpTimeoutMs: number;
  requestBudgetMs: number;
  maxConsecutiveProviderFailures: number;
}

export interface Deps {
  llm: LlmClient;
  fetch: typeof fetch;
  now?: () => Date;
  config?: Partial<Config>;
}
