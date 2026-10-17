/**
 * Shared client-side types — mirror server/domain/types.ts (kept in sync by
 * convention). The server is the source of truth.
 */

export type ProbabilityMode = "illustrative" | "unavailable" | "computed";
export type EvidenceValidationStatus = "supported" | "contradicted" | "insufficient" | "inaccessible";
export interface PendingDiagnosis { hypothesisId: string; name: string; reason: string }
export type ProbabilityAssessment =
  | { status: "unavailable"; reason: string }
  | { status: "computed"; mode: "illustrative"; value: number; prior: number; likelihoodRatio: number; modelId: string; modelVersion: string };

export type Sex = "male" | "female" | "intersex" | "unknown";

export interface Demographics {
  ageYears?: number;
  sex?: Sex;
  raceEthnicity?: string;
  location?: string;
  comorbidities?: string[];
}

export interface Presentation {
  chiefComplaint: string;
  history?: string;
  observations?: string[];
  demographics: Demographics;
}

export type HypothesisStatus = "live" | "branched" | "confirmed" | "ruled_out";

export interface Hypothesis {
  id: string;
  name: string;
  description?: string;
  codes?: { system: string; code: string; display?: string; url?: string; reasoning?: string }[];
  /** Relative ranking/layout weight; guided-tour values are illustrative. */
  probability: number;
  probabilityMode?: ProbabilityMode;
  status: HypothesisStatus;
  parentId: string | null;
  childIds: string[];
  evidenceFor: { findingId: string; weight: string }[];
  evidenceAgainst: { findingId: string; weight: string }[];
  branchedBecause?: string;
  discriminatingTests?: TestProposal[];
  isZebra?: boolean;
  modelSuggestedZebra?: boolean;
  rarity?: RarityAssessment;
  populationContextUsed?: { round: number; pass: number; recordIds: string[] };
  baseRateNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PopulationFrequency {
  kind: 'exact' | 'range' | 'less_than' | 'greater_than';
  formulaVersion: 'population-percent-v1';
  boundsInclusivity: string;
  lowerPer100000?: number;
  upperPer100000?: number;
  percentDisplay: string;
  formula: string;
  rounding: string;
}
export interface RarityRecord {
  id: string; metric: string; prevalenceClass: string; valuePer100000: number | null;
  geography: string; validationStatus: string; source: string; sourceUrls: string[];
  studyDate: string | null; frequency?: PopulationFrequency;
}
export interface RarityAssessment {
  status: 'matched' | 'unknown' | 'unavailable';
  classification?: 'below_reference_threshold' | 'above_reference_threshold' | 'uncertain';
  reason: string;
  entity?: { orphaCode: string; name: string; url: string };
  geography?: string;
  release?: string;
  exportDate?: string;
  dataHash?: string;
  records?: RarityRecord[];
  allEligibleRecords?: RarityRecord[];
  geographyPolicy?: string;
}

export type SourceType =
  | "paper"
  | "trial"
  | "guideline"
  | "drug"
  | "code"
  | "calculator"
  | "web"
  | "other";

/**
 * A citable artifact. `index` is the number rendered in inline markers and is
 * stable for the life of the case — the pool is append-only.
 */
export interface Source {
  index: number;
  title: string;
  url?: string;
  identifier?: string;
  type: SourceType;
  note?: string;
  addedRound: number;
  excerpt?: string;
  retrievedAt?: string;
  validationStatus?: EvidenceValidationStatus;
}

export interface Finding {
  id: string;
  summary: string;
  detail?: string;
  source: string;
  hypothetical?: boolean;
  direction: "supports" | "against" | "neutral";
  hypothesisIds: string[];
  /** @deprecated superseded by `sourceIndices` + the case Source pool. */
  citation?: { label: string; url?: string };
  /** Indices into `Case.sources` backing this finding. */
  sourceIndices?: number[];
  validationStatus?: EvidenceValidationStatus;
  createdAt: string;
}

export interface TestProposal {
  id: string;
  name: string;
  rationale: string;
  discriminatesBetween: string[];
  status: "proposed" | "ordered" | "resulted";
  resultFindingId?: string;
}

export type CaseStatus =
  | "intake"
  | "reasoning"
  | "converged"
  | "treatment"
  | "closed";

export interface WorkingDiagnosis {
  hypothesisId: string;
  name: string;
  confidence?: number;
  reasoningTrail: string[];
  concludedAt: string;
}

export interface TreatmentPlan {
  summary: string;
  steps: { title: string; detail?: string; citation?: { label: string; url?: string } }[];
  caseFinding?: {
    summary: string;
    sites: { label: string; url?: string; note?: string }[];
  };
  createdAt: string;
}

export interface CaseEvent {
  id: string;
  round: number;
  kind: string;
  summary: string;
  payload?: unknown;
  createdAt: string;
}

/** What kind of step produced a history entry (drives the scrubber's labels). */
export type HistoryKind =
  | "intake"
  | "fork"
  | "round"
  | "finding"
  | "diagnosis"
  | "treatment";

/**
 * One frame of the case's reasoning tape — a complete, renderable state as it
 * stood at the end of a step. See domain/history.ts for why these are stored
 * rather than reconstructed.
 */
export interface HistoryEntry {
  /** Position on the tape; also the scrubber's index. */
  seq: number;
  round: number;
  kind: HistoryKind;
  /** Human label for the scrubber: "Intake", "Round 3", "Result: ASO titre". */
  label: string;
  at: string;
  status: CaseStatus;
  hypotheses: Record<string, Hypothesis>;
  rootHypothesisIds: string[];
  findings: Finding[];
  sources: Source[];
  tests: TestProposal[];
  workingDiagnosis?: WorkingDiagnosis;
  pendingDiagnosis?: PendingDiagnosis;
  probabilityMode?: ProbabilityMode;
  probabilityCalculation?: ProbabilityAssessment;
  treatmentPlan?: TreatmentPlan;
  awaitingHitl: boolean;
  hitlPrompt?: string;
  /** How many events had been logged by the end of this step. */
  eventCount: number;
}

export interface ForkOrigin {
  parentCaseId: string;
  parentTitle: string;
  parentFrameSeq: number;
  parentFrameLabel: string;
  forkedAt: string;
}

export interface Case {
  id: string;
  title: string;
  forkOrigin?: ForkOrigin;
  status: CaseStatus;
  presentation: Presentation;
  hypotheses: Record<string, Hypothesis>;
  rootHypothesisIds: string[];
  findings: Finding[];
  /** Append-only, deduplicated citable source pool; index === marker number. */
  sources: Source[];
  tests: TestProposal[];
  events: CaseEvent[];
  workingDiagnosis?: WorkingDiagnosis;
  pendingDiagnosis?: PendingDiagnosis;
  probabilityMode?: ProbabilityMode;
  probabilityCalculation?: ProbabilityAssessment;
  treatmentPlan?: TreatmentPlan;
  round: number;
  awaitingHitl: boolean;
  hitlPrompt?: string;
  /** Append-only tape of past states, one per step. Enables time travel. */
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
