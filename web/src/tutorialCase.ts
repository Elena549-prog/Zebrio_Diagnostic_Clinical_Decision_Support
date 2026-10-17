/**
 * tutorialCase — the scripted, canned data for the guided tutorial route.
 *
 * The tutorial replays one coherent patient case as a sequence of full
 * `Case` snapshots. No live API is called: every snapshot is a complete
 * tree + findings + tests + verdict, so stepping is instant and the real
 * workspace components (DecisionTree, EvidencePanel, DetailPanel,
 * RankedDifferential) render real, interactive data — clicking a node
 * really opens its evidence on the right; numbers really shift between
 * steps.
 *
 * The case is the fever + migrating-joint-pain young adult. It is chosen
 * because it exercises every feature the tour must show:
 *   - an initial differential with a clear "horse" and a rare "zebra"
 *   - demographic base-rate adjustment (young adult, rural Minnesota)
 *   - a branching finding (a positive strep test splits the meaning of
 *     "post-strep" into ARF vs PSRA)
 *   - a HITL test gate
 *   - scripted evidence with citations
 *   - convergence to a working diagnosis with a reasoning trail
 *   - a treatment plan with surgical case-finding
 *
 * Each step also carries teaching text: a caption, the concept to look
 * at, and (optionally) the id of the hypothesis the tour highlights.
 */

import type { Case, Finding, Hypothesis, TestProposal, HistoryEntry} from "./types.js";

// Stable ids so cross-references resolve across snapshots.
const H = {
  arf: "h-arf",
  psra: "h-psra",
  viral: "h-viral",
  septic: "h-septic",
  lyme: "h-lyme",
};
const F = {
  fever: "f-fever",
  joints: "f-joints",
  sorethroat: "f-sorethroat",
  strepPos: "f-streppos",
  echo: "f-echo",
  cultures: "f-cultures",
  lymeSer: "f-lyme-ser",
  migration: "f-migration",
};
const T = {
  rapidStrep: "t-rapidstrep",
  echo: "t-echo",
  cultures: "t-cultures",
  lymeSer: "t-lyme-ser",
};

const presentation = {
  chiefComplaint: "Fever and migrating joint pain for 8 days",
  history:
    "Started with a sore throat 2 weeks ago, now large joints (knees, ankles) ache and migrate over days. Fever 38.5–39°C. General malaise. No trauma. No prior similar episodes.",
  observations: [
    "T 38.7°C, HR 102, BP 118/74, RR 18",
    "Swollen tender left knee, right ankle — warm but not erythematous",
    "No mucosal lesions, no tick bite recalled",
  ],
  demographics: {
    ageYears: 19,
    sex: "male" as const,
    raceEthnicity: "Northern European",
    location: "rural Minnesota, USA",
    comorbidities: [],
  },
};

/** Helper: build a hypothesis with defaults filled. */
function hypo(p: Partial<Hypothesis> & { id: string; name: string }): Hypothesis {
  return {
    probability: 0,
    status: "live",
    parentId: null,
    childIds: [],
    evidenceFor: [],
    evidenceAgainst: [],
    createdAt: "",
    updatedAt: "",
    ...p,
  };
}

/** Helper: build a finding with defaults filled. */
function finding(p: Partial<Finding> & { id: string; summary: string; direction: Finding["direction"]; source: string }): Finding {
  return {
    hypothesisIds: [],
    createdAt: "",
    ...p,
  };
}

/** Helper: build a test proposal with defaults filled. */
function test(p: Partial<TestProposal> & { id: string; name: string; rationale: string }): TestProposal {
  return {
    discriminatesBetween: [],
    status: "proposed",
    ...p,
  };
}

export interface TutorialStep {
  /** Which snapshot to render. */
  case: Case;
  /** Short label for the rail breadcrumb. */
  label: string;
  /** One-line stage label (mirrors NextAction's stage line). */
  stage: string;
  /** Teaching caption shown in the tutorial card. */
  caption: string;
  /** The concept this step showcases (for the "what to look at" cue). */
  spotlight:
    | "presentation"
    | "initial-diff"
    | "horses-zebras"
    | "hitl-gate"
    | "branching"
    | "evidence"
    | "converge"
    | "treatment";
  /** Hypothesis id to auto-select / highlight (optional). */
  highlightId?: string;
}

const baseCase = {
  id: "tutorial",
  title: "Tutorial — fever + migrating joint pain",
  presentation,
  hypotheses: {},
  rootHypothesisIds: [] as string[],
  findings: [] as Finding[],
  tests: [] as TestProposal[],
  events: [],
  round: 0,
  awaitingHitl: false,
  // The canned tour predates the grounded-citation pass; it carries no source
  // pool, so <Cited> renders its text plainly with no markers.
  sources: [],
  history: [] as HistoryEntry[],
  createdAt: "",
  updatedAt: "",
};

// ---- Step 0: Intake -------------------------------------------------------
const step0: Case = {
  ...baseCase,
  status: "intake",
  round: 0,
  findings: [],
  tests: [],
};

// ---- Step 1: Initial differential (round 1) -----------------------------
// The horse is viral/post-infectious; the zebra is acute rheumatic fever.
const step1: Case = {
  ...baseCase,
  status: "reasoning",
  round: 1,
  rootHypothesisIds: [H.viral, H.arf, H.psra, H.septic, H.lyme],
  hypotheses: {
    [H.viral]: hypo({
      id: H.viral,
      name: "Viral / post-infectious arthralgia",
      description:
        "A common, self-limited inflammatory arthropathy following a viral illness. The leading candidate by base rate.",
      probability: 0.42,
      status: "live",
      baseRateNote:
        "Most common cause of transient migrating arthralgia in a young adult. No specific test — diagnosis of exclusion.",
      evidenceFor: [
        { findingId: F.fever, weight: "moderate" },
        { findingId: F.joints, weight: "moderate" },
      ],
      codes: [{ system: "SNOMED", code: "373170000", display: "Viral arthropathy" }],
    }),
    [H.arf]: hypo({
      id: H.arf,
      name: "Acute rheumatic fever (ARF)",
      description:
        "A delayed autoimmune sequel of group A strep pharyngitis. Rare in the US, but the strep history and migratory polyarthritis fit the Jones criteria.",
      probability: 0.16,
      status: "live",
      isZebra: true,
      baseRateNote:
        "Rare in high-income settings (~1/100,000/yr), but rural / Northern European / young-adult demographics and a recent sore throat raise the prior above baseline.",
      evidenceFor: [
        { findingId: F.fever, weight: "moderate" },
        { findingId: F.joints, weight: "strong" },
        { findingId: F.sorethroat, weight: "moderate" },
      ],
      codes: [{ system: "ICD-10", code: "I00", display: "Acute rheumatic fever" }],
    }),
    [H.psra]: hypo({
      id: H.psra,
      name: "Post-streptococcal reactive arthritis (PSRA)",
      description:
        "A reactive arthritis after strep infection, distinct from ARF — arthritis is the dominant feature but does not fulfill Jones criteria.",
      probability: 0.14,
      status: "live",
      isZebra: true,
      baseRateNote: "Less common than viral arthropathy; considered when strep exposure is documented but ARF criteria are not met.",
      evidenceFor: [{ findingId: F.joints, weight: "moderate" }],
      codes: [{ system: "ICD-10", code: "M03.0", display: "Post-streptococcal arthropathy" }],
    }),
    [H.septic]: hypo({
      id: H.septic,
      name: "Septic arthritis",
      description: "An infected joint — typically a single hot swollen joint, not migratory. Kept low until excluded.",
      probability: 0.08,
      status: "live",
      baseRateNote: "Low given the migratory pattern and absence of a single hot joint, but dangerous — not dropped from the tree.",
      evidenceAgainst: [{ findingId: F.joints, weight: "moderate" }],
    }),
    [H.lyme]: hypo({
      id: H.lyme,
      name: "Lyme disease",
      description: "A tick-borne arthropathy. No tick bite recalled, but rural Minnesota is endemic.",
      probability: 0.1,
      status: "live",
      isZebra: true,
      baseRateNote: "Rural Minnesota is an endemic county, but the migratory large-joint pattern is atypical. Kept on the tree.",
      evidenceAgainst: [{ findingId: F.joints, weight: "weak" }],
    }),
  },
  findings: [
    finding({
      id: F.fever,
      summary: "Fever 38.7°C with migratory large-joint pain",
      direction: "supports",
      source: "presentation",
      hypothesisIds: [H.viral, H.arf, H.psra],
      detail: "Intermittent fever 38.5–39°C over 8 days.",
    }),
    finding({
      id: F.joints,
      summary: "Migratory polyarthritis (knee → ankle)",
      direction: "supports",
      source: "presentation",
      hypothesisIds: [H.arf, H.psra, H.viral],
      detail: "Large joints, pain migrating over days — a classic Jones major criterion for ARF.",
    }),
    finding({
      id: F.sorethroat,
      summary: "Sore throat ~2 weeks before onset",
      direction: "supports",
      source: "history",
      hypothesisIds: [H.arf, H.psra],
      detail: "A preceding group A strep infection is the trigger for ARF and PSRA.",
    }),
  ],
  tests: [],
};

// ---- Step 2: The HITL gate — engine proposes a rapid strep test ----------
const step2: Case = {
  ...step1,
  round: 1,
  awaitingHitl: true,
  hitlPrompt:
    "Order a rapid strep test / anti-streptolysin O (ASO) titre. A positive strep result would split the meaning of the post-strep hypotheses (ARF vs PSRA) from the viral and septic tracks.",
  tests: [
    test({
      id: T.rapidStrep,
      name: "Rapid strep test + ASO titre",
      rationale:
        "Best single test to split the post-streptococcal hypotheses (ARF, PSRA) from viral arthralgia and septic arthritis.",
      discriminatesBetween: [H.arf, H.psra, H.viral],
      status: "proposed",
    }),
  ],
};

// ---- Step 3: Branching — a positive strep result splits the tree ----------
// The positive strep result splits the post-strep track from the viral track.
// ARF rises to lead; PSRA stays on the tree (down-weighted); viral drops.
const step3: Case = {
  ...baseCase,
  status: "reasoning",
  round: 2,
  rootHypothesisIds: [H.viral, H.arf, H.psra, H.septic, H.lyme],
  hypotheses: {
    [H.viral]: {
      ...step1.hypotheses[H.viral]!,
      probability: 0.14,
      status: "live",
      evidenceAgainst: [{ findingId: F.strepPos, weight: "strong" }],
    },
    [H.septic]: {
      ...step1.hypotheses[H.septic]!,
      probability: 0.04,
      status: "live",
    },
    [H.lyme]: {
      ...step1.hypotheses[H.lyme]!,
      probability: 0.06,
      status: "live",
    },
    [H.arf]: {
      ...step1.hypotheses[H.arf]!,
      probability: 0.52,
      status: "live",
      branchedBecause: "positive strep test",
      evidenceFor: [
        ...step1.hypotheses[H.arf]!.evidenceFor,
        { findingId: F.strepPos, weight: "strong" },
      ],
    },
    [H.psra]: {
      ...step1.hypotheses[H.psra]!,
      probability: 0.18,
      status: "live",
      branchedBecause: "positive strep test",
      evidenceFor: [
        ...step1.hypotheses[H.psra]!.evidenceFor,
        { findingId: F.strepPos, weight: "moderate" },
      ],
    },
  },
  findings: [
    ...step1.findings,
    finding({
      id: F.strepPos,
      summary: "Rapid strep: positive · ASO 480 IU/mL (raised)",
      direction: "supports",
      source: "clinician",
      hypothesisIds: [H.arf, H.psra],
      detail: "Positive strep evidence supports the post-streptococcal track and down-weights viral arthralgia.",
      citation: { label: "Jones criteria revision, AHA 2015", url: "https://doi.org/10.1161/CIR.0000000000000205" },
    }),
  ],
  tests: [
    test({
      id: T.rapidStrep,
      name: "Rapid strep test + ASO titre",
      rationale: "Split the post-streptococcal hypotheses from viral and septic tracks.",
      discriminatesBetween: [H.arf, H.psra, H.viral],
      status: "resulted",
      resultFindingId: F.strepPos,
    }),
  ],
};

// ---- Step 4: Evidence deep-dive — scripted sources illustrate grounding --
const step4: Case = {
  ...step3,
  round: 2,
  hypotheses: {
    ...step3.hypotheses,
    [H.arf]: {
      ...step3.hypotheses[H.arf]!,
      description:
        "A delayed autoimmune sequel of group A strep pharyngitis. The migratory polyarthritis + raised ASO fit the updated Jones criteria. This scripted example illustrates cited evidence; no live experts were called in the guided tour.",
      evidenceFor: [
        { findingId: F.fever, weight: "moderate" },
        { findingId: F.joints, weight: "strong" },
        { findingId: F.sorethroat, weight: "moderate" },
        { findingId: F.strepPos, weight: "strong" },
      ],
      discriminatingTests: [
        {
          id: "dt-echo",
          name: "Echocardiogram",
          rationale: "Confirm carditis — a major Jones criterion and the most common serious complication of ARF.",
          discriminatesBetween: [H.arf, H.psra],
          status: "proposed",
        },
      ],
    },
  },
};

// ---- Step 5: Convergence — working diagnosis set -------------------------
const step5: Case = {
  ...step4,
  status: "converged",
  round: 3,
  awaitingHitl: false,
  hypotheses: {
    ...step4.hypotheses,
    [H.arf]: {
      ...step4.hypotheses[H.arf]!,
      probability: 0.74,
      status: "confirmed",
    },
    [H.psra]: { ...step4.hypotheses[H.psra]!, probability: 0.05, status: "ruled_out" },
    [H.viral]: { ...step4.hypotheses[H.viral]!, probability: 0.08, status: "ruled_out" },
    [H.septic]: { ...step4.hypotheses[H.septic]!, probability: 0.02, status: "ruled_out" },
    [H.lyme]: { ...step4.hypotheses[H.lyme]!, probability: 0.03, status: "ruled_out" },
  },
  findings: [
    ...step4.findings,
    finding({
      id: F.echo,
      summary: "Echocardiogram: mild mitral regurgitation with thickened leaflets",
      direction: "supports",
      source: "clinician",
      hypothesisIds: [H.arf],
      detail: "Carditis — a major Jones criterion. Together with migratory polyarthritis and raised ASO, confirms ARF.",
      citation: { label: "Jones criteria revision, AHA 2015 — carditis", url: "https://doi.org/10.1161/CIR.0000000000000205" },
    }),
  ],
  tests: [
    ...step4.tests,
    test({
      id: T.echo,
      name: "Echocardiogram",
      rationale: "Confirm carditis, the major Jones criterion distinguishing ARF from PSRA.",
      discriminatesBetween: [H.arf, H.psra],
      status: "resulted",
      resultFindingId: F.echo,
    }),
  ],
  workingDiagnosis: {
    hypothesisId: H.arf,
    name: "Acute rheumatic fever (ARF)",
    confidence: 0.78,
    reasoningTrail: [
      "Presentation: fever + migratory polyarthritis in a young adult (rural Minnesota).",
      "Initial differential led by viral arthralgia; ARF flagged 🦓 zebra but kept on the tree by base-rate adjustment.",
      "Rapid strep + ASO positive — split the post-strep track (ARF / PSRA) from viral; viral down-weighted.",
      "Echocardiogram showed mitral regurgitation — carditis, a major Jones criterion.",
      "ARF dominates; viral, septic, and Lyme ruled out but remain on the tree for the trail.",
    ],
    concludedAt: "",
  },
};

// ---- Step 6: Treatment plan + surgical case-finding ----------------------
const step6: Case = {
  ...step5,
  status: "treatment",
  treatmentPlan: {
    summary:
      "Anti-inflammatory management for ARF, antibiotics to eradicate strep, and secondary prophylaxis. Echocardiographic follow-up for carditis.",
    steps: [
      {
        title: "High-dose aspirin / NSAID for arthritis",
        detail: "Anti-inflammatory dosing until symptoms and inflammatory markers settle.",
        citation: { label: "AHA 2015 statement (diagnosis, not a treatment guideline)", url: "https://doi.org/10.1161/CIR.0000000000000205" },
      },
      {
        title: "Penicillin — eradication + secondary prophylaxis",
        detail: "A single IM benzathine penicillin dose to eradicate group A strep, then monthly prophylaxis.",
      },
      {
        title: "Echocardiogram at 1 month, then serial follow-up",
        detail: "Monitor resolution of carditis and valve recovery.",
      },
    ],
    caseFinding: {
      summary:
        "Valvular sequelae of ARF may need valve repair. Case-finding of where mitral valve repair for rheumatic disease is performed:",
      sites: [
        { label: "Rheumatic mitral valve repair centres", note: "illustrative placeholder — no source retrieved in the guided tour" },
        { label: "Rheumatic heart disease registry", note: "illustrative placeholder — no source retrieved in the guided tour" },
        { label: "Local cardiac surgery (Minneapolis)", note: "illustrative placeholder — closest to the patient" },
      ],
    },
    createdAt: "",
  },
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    case: step0,
    label: "Intake",
    stage: "intake",
    caption:
      "A 19-year-old man presents with 8 days of fever and migrating joint pain after a sore throat two weeks ago. The presentation seeds the whole tree. Nothing has been reasoned yet — advance to generate the differential.",
    spotlight: "presentation",
  },
  {
    case: step1,
    label: "Round 1",
    stage: "reasoning",
    caption:
      "The engine generates the initial differential. Viral arthralgia leads by base rate (the “horse”). Acute rheumatic fever is rare but fits — it’s flagged 🦓 zebra and kept on the tree, never silently dropped. Click nodes to read why each is on the list.",
    spotlight: "initial-diff",
    highlightId: H.arf,
  },
  {
    case: step2,
    label: "Test gate",
    stage: "awaiting your test result",
    caption:
      "The engine proposes the test that best splits the remaining differential — a rapid strep test + ASO titre. This is the human-in-the-loop gate: the agent proposes, the clinician orders it and enters the result. (In this tutorial, the result is scripted — click “Enter scripted result & advance” to continue.)",
    spotlight: "hitl-gate",
  },
  {
    case: step3,
    label: "Round 2",
    stage: "reasoning",
    caption:
      "The positive strep result splits the tree. The post-strep track (ARF / PSRA) is now supported and branches; viral arthralgia drops. Notice ruled-out branches stay visible — the reasoning is retraceable. Toggle the List view to see the same data ranked.",
    spotlight: "branching",
    highlightId: H.arf,
  },
  {
    case: step4,
    label: "Evidence",
    stage: "reasoning",
    caption:
      "This scripted example illustrates source-linked evidence and discriminating tests (here, an echocardiogram to assess carditis). The evidence and percentages are teaching examples. Click the leading node to see its evidence trail.",
    spotlight: "evidence",
    highlightId: H.arf,
  },
  {
    case: step5,
    label: "Working dx",
    stage: "working diagnosis set",
    caption:
      "The echo shows mitral regurgitation — carditis, a major Jones criterion. ARF now dominates and the clinician sets the working diagnosis. The reasoning trail records every branch taken and pruned, so the verdict is auditable.",
    spotlight: "converge",
    highlightId: H.arf,
  },
  {
    case: step6,
    label: "Treatment",
    stage: "treatment plan",
    caption:
      "A second agent proposes a management plan — anti-inflammatories, penicillin, echo follow-up — and searches where in the world the relevant procedure (rheumatic valve repair) has been performed. The case is complete, end to end.",
    spotlight: "treatment",
  },
];

/**
 * Give the tour a reasoning tape.
 *
 * The tutorial is already a scripted sequence of complete case states, which is
 * exactly what a history entry is — so each step's tape is simply every step up
 * to and including it. That makes the scrubber live in the tour too, where most
 * people meet Arbor first, with no second set of canned data to maintain.
 */
const HISTORY_KINDS: HistoryEntry["kind"][] = [
  "intake",
  "round",
  "finding",
  "round",
  "round",
  "diagnosis",
  "treatment",
];

for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
  TUTORIAL_STEPS[i]!.case.probabilityMode = "illustrative";
  TUTORIAL_STEPS[i]!.case.history = TUTORIAL_STEPS.slice(0, i + 1).map((st, seq) => ({
    seq,
    round: st.case.round,
    kind: HISTORY_KINDS[seq] ?? "round",
    label: st.label,
    at: st.case.updatedAt || "",
    status: st.case.status,
    probabilityMode: "illustrative",
    hypotheses: st.case.hypotheses,
    rootHypothesisIds: st.case.rootHypothesisIds,
    findings: st.case.findings,
    sources: st.case.sources,
    tests: st.case.tests,
    workingDiagnosis: st.case.workingDiagnosis,
    treatmentPlan: st.case.treatmentPlan,
    awaitingHitl: st.case.awaitingHitl,
    hitlPrompt: st.case.hitlPrompt,
    eventCount: st.case.events.length,
  }));
}
