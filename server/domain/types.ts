/**
 * Arbor domain model — the reasoning tree and everything that lives on it.
 *
 * This is the wire shape between the server engine and the web UI, and the
 * persisted shape of a Case. It is deliberately self-describing so the UI can
 * render the tree and the reasoning trail with no extra metadata calls.
 */

// ---- Demographics & presentation ----------------------------------------

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
  /** Free-text self-identified race/ethnicity, e.g. "Ashkenazi Jewish". */
  raceEthnicity?: string;
  /** Free-text geography/location, e.g. "rural East Africa" or "Stockholm, SE". */
  location?: string;
  /** Known comorbidities / relevant history, free text. */
  comorbidities?: string[];
}

export interface Presentation {
  /** Chief complaint in the clinician's / patient's words. */
  chiefComplaint: string;
  /** Narrative of the presenting story (HPI). */
  history?: string;
  /** Already-collected observations: vitals, exam, prelim labs. */
  observations?: string[];
  demographics: Demographics;
}

// ---- The tree ------------------------------------------------------------

export type HypothesisStatus =
  | "live" // actively in the running
  | "branched" // refined into children; node itself is no longer terminal
  | "confirmed" // the working diagnosis
  | "ruled_out"; // pruned — kept on the tree for the trail

/**
 * One candidate explanation of the presentation. A node in the reasoning tree.
 *
 * The legacy probability field stores normalized ranking/layout weights in
 * live cases, not patient probabilities. A clinical model result needs its
 * own target, inputs and provenance; the reasoning tree is not a probability
 * distribution over mutually exclusive diseases.
 */
export interface Hypothesis {
  id: string;
  name: string;
  /** Short plain-language description / illness script. */
  description?: string;
  /** ICD-10 / SNOMED codes from the coding expert, if any. */
  codes?: { system: string; code: string; display?: string; url?: string; reasoning?: string }[];
  /** Relative ranking/layout weight; guided-tour values are illustrative. */
  probability: number;
  probabilityMode?: ProbabilityMode;
  status: HypothesisStatus;
  /** Parent hypothesis id; null for top-level hypotheses. */
  parentId: string | null;
  /** Child hypothesis ids (when this one branched). */
  childIds: string[];
  /** Findings supporting this hypothesis. */
  evidenceFor: EvidenceRef[];
  /** Findings arguing against it. */
  evidenceAgainst: EvidenceRef[];
  /** The finding/observation that caused this node to be branched or pruned. */
  branchedBecause?: string;
  /** The test(s) that would best confirm/refute this, from the engine. */
  discriminatingTests?: TestProposal[];
  /** Is this a rare ("zebra") diagnosis? Surfaced so it isn't dropped early. */
  isZebra?: boolean;
  /** Base-rate prior used by the engine (prevalence in this demographic). */
  baseRateNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRef {
  findingId: string;
  /** Why this finding bears on the hypothesis, in a phrase. */
  weight: string;
}

// ---- Sources & citations --------------------------------------------------

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
 * A citable artifact. Sources live in one append-only, deduplicated pool per
 * Case; `index` IS the inline marker number and must never change. Prose across
 * the case carries `[3]`-style markers that index into this pool.
 */
export interface Source {
  /** 1-based position in the case pool — the number rendered in prose. */
  index: number;
  title: string;
  url?: string;
  /** DOI / PMID / NCT id where the expert returned one. */
  identifier?: string;
  type: SourceType;
  /** One line on why this source bears on the case. */
  note?: string;
  /** The round whose evidence pass first surfaced it. */
  addedRound: number;
  excerpt?: string;
  retrievedAt?: string;
  validationStatus?: EvidenceValidationStatus;
}

// ---- Findings & tests -----------------------------------------------------

export type FindingSource =
  | "clinician" // entered by the human
  | "lab" // a test result
  | "exam" // physical exam
  | "literature" // pubmed / trials
  | "calculator" // medical-calculator
  | "web"; // web-search

export type FindingDirection = "supports" | "against" | "neutral";

export interface Finding {
  id: string;
  /** What was found, in a sentence. */
  summary: string;
  /** Structured detail (e.g. a lab value with units). */
  detail?: string;
  source: FindingSource;
  /** A simulated input in a what-if case, not an actual patient observation. */
  hypothetical?: boolean;
  direction: FindingDirection;
  /** Which hypothesis ids this finding bears on. */
  hypothesisIds: string[];
  /**
   * Citation link if literature/web.
   * @deprecated Superseded by `sourceIndices` + the case Source pool; retained
   * so cases persisted before ADR 0003 still render.
   */
  citation?: { label: string; url?: string };
  /** Indices into `Case.sources` backing this finding. */
  sourceIndices?: number[];
  validationStatus?: EvidenceValidationStatus;
  createdAt: string;
}

export interface TestProposal {
  id: string;
  name: string;
  /** Why this test — which hypotheses it splits. */
  rationale: string;
  /** Which hypothesis ids it discriminates between. */
  discriminatesBetween: string[];
  status: "proposed" | "ordered" | "resulted";
  resultFindingId?: string;
}

// ---- The verdict ---------------------------------------------------------

export type CaseStatus =
  | "intake" // capturing presentation
  | "reasoning" // cycling the differential
  | "converged" // working diagnosis reached
  | "treatment" // building the plan
  | "closed"; // done

export interface WorkingDiagnosis {
  hypothesisId: string;
  name: string;
  confidence?: number; // 0–1
  /** The narrative path from presentation to this conclusion. */
  reasoningTrail: string[];
  concludedAt: string;
}

export interface TreatmentPlan {
  summary: string;
  /** Proposed next actions / management steps. */
  steps: { title: string; detail?: string; citation?: { label: string; url?: string } }[];
  /** Surgical case-finding: where this has been done, outcomes, techniques. */
  caseFinding?: {
    summary: string;
    sites: { label: string; url?: string; note?: string }[];
  };
  createdAt: string;
}

// ---- The Case (session) --------------------------------------------------

export interface CaseEvent {
  id: string;
  /** Sequential round index this event belongs to. */
  round: number;
  /** What happened. */
  kind:
    | "presentation" // intake recorded
    | "hypotheses" // differential updated
    | "finding" // a finding landed
    | "test_proposed" // engine suggests a test
    | "test_ordered" // clinician ordered / result entered
    | "engine_message" // free-text from the engine
    | "hitl" // a human-in-the-loop gate
    | "diagnosis" // working diagnosis reached
    | "treatment"; // plan produced
  /** Human-readable summary. */
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
  /** Presence marks a separate hypothetical exploration, never the parent record. */
  forkOrigin?: ForkOrigin;
  status: CaseStatus;
  presentation: Presentation;
  /** The full hypothesis tree, keyed by id. */
  hypotheses: Record<string, Hypothesis>;
  /** Root-level hypothesis ids (the top differential). */
  rootHypothesisIds: string[];
  findings: Finding[];
  /**
   * The case's citable Source pool — append-only, deduplicated. A Source's
   * position here is its inline marker number, so entries are never sorted,
   * compacted, or removed.
   */
  sources: Source[];
  tests: TestProposal[];
  events: CaseEvent[];
  workingDiagnosis?: WorkingDiagnosis;
  pendingDiagnosis?: PendingDiagnosis;
  probabilityMode?: ProbabilityMode;
  probabilityCalculation?: ProbabilityAssessment;
  treatmentPlan?: TreatmentPlan;
  /** Current reasoning round (0 = pre-cycle). */
  round: number;
  /** True when paused for a clinician HITL action. */
  awaitingHitl: boolean;
  /** What the HITL gate is asking for, when awaiting. */
  hitlPrompt?: string;
  /** Append-only tape of past states, one per step. Enables time travel. */
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Public snapshot of a Case for the API/UI (everything; secrets never here). */
export type CaseSnapshot = Case;

// ---- Engine state machine decisions --------------------------------------

export type EngineDecision =
  | { kind: "converged"; hypothesisId: string; confidence?: number }
  | { kind: "test"; test: TestProposal }
  | { kind: "gather"; reason: string };

export interface EngineRoundResult {
  /** New/updated hypotheses merged into the tree this round. */
  hypotheses: Hypothesis[];
  /** Findings produced this round (from experts / clinician). */
  findings: Finding[];
  /** The engine's free-text narration for the chat. */
  message: string;
  /** What the engine wants to do next. */
  decision: EngineDecision;
  /** Hypothesis ids that were ruled out / branched this round (for the trail). */
  pruned: string[];
}
