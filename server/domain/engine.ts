import { askJson } from "../anthropic/runtime.js";
import { HYPOTHESIS_ENGINE_PROMPT } from "./agent-definitions.js";
import {
  AGENT_NAMES,
} from "./agent-definitions.js";
import { groundLinks } from "./parse.js";
import { appendEvent, newId } from "./case-store.js";
import {
  citedIndices,
  mergeSources,
  renderSourcePool,
  rewriteMarkers,
  stripMarkers,
} from "./sources.js";
import type {
  Case,
  EngineDecision,
  EngineRoundResult,
  Finding,
  Hypothesis,
  TestProposal,
} from "./types.js";

// ---- The structured shape we ask the engine to return --------------------

interface EngineRawHypothesis {
  name: string;
  description?: string;
  /**
   * Raw, UNTRUSTED codes straight off the model. Deliberately `unknown`: the
   * model has been observed to return `["ICD-10:I00"]` (an array of strings)
   * instead of the documented object form, which used to render as a bare
   * ":" row in the UI. Everything must go through `normalizeCodes`.
   */
  codes?: unknown;
  /** 0–100 for ergonomics; we normalize to 0–1. */
  rank?: number;
  rulesOutEvidenceIds?: string[];
  isZebra?: boolean;
  baseRateNote?: string;
  /** Parent name in the prior differential, if this is a branch refinement. */
  parent?: string;
  /** If set, this hypothesis rules out the named hypothesis. */
  rulesOut?: string[];
  /** Tests that would discriminate this hypothesis. */
  discriminatingTests?: { name: string; rationale: string; discriminatesBetween?: string[] }[];
}

interface EngineRawResponse {
  hypotheses: EngineRawHypothesis[];
  /** Sources the engine newly introduces this round (ref "N1", "N2", ...). */
  /** Findings produced this round (free text + direction). */
  findings?: {
    summary: string;
    detail?: string;
    direction?: "supports" | "against" | "neutral";
    hypothesisNames?: string[];
    citation?: { label: string; url?: string };
    /** Refs into the pool / this response's sources, e.g. ["S1","N2"]. */
    sourceRefs?: string[];
    source?: string;
  }[];
  /** Free-text narration for the clinician chat. */
  message: string;
  decision:
    | { kind: "converged"; hypothesisName: string }
    | { kind: "test"; name: string; rationale: string; discriminatesBetween?: string[] }
    | { kind: "gather"; reason: string };
}

// ---- Helpers --------------------------------------------------------------

type Code = { system: string; code: string; display?: string };

/**
 * Coerce the model's `codes` into the documented `{system, code, display?}`
 * shape, dropping anything unusable.
 *
 * The model is inconsistent here: sometimes it returns proper objects, and
 * sometimes an array of `"SYSTEM:CODE Display"` strings. The string form used
 * to flow through unchanged, so `c.system`/`c.code` were `undefined` and the
 * DetailPanel rendered a bare ":" row. We recover the string form rather than
 * discard it (the data is really there, just badly shaped) and drop entries
 * that have no usable system+code, so a bad response can never reach the DOM.
 */
export function normalizeCodes(raw: unknown): Code[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Code[] = [];
  for (const entry of raw) {
    const c = coerceCode(entry);
    if (c) out.push(c);
  }
  return out.length ? out : undefined;
}

function coerceCode(entry: unknown): Code | null {
  // "ICD-10:I00" / "SNOMED: 373170000 Viral arthropathy"
  if (typeof entry === "string") {
    const m = /^\s*([^:]+?)\s*:\s*(\S+)\s*(.*)$/.exec(entry);
    if (!m) return null;
    const [, system, code, display] = m;
    return mk(system, code, display);
  }
  if (entry && typeof entry === "object") {
    const o = entry as Record<string, unknown>;
    return mk(o.system, o.code, o.display);
  }
  return null;
}

function mk(system: unknown, code: unknown, display: unknown): Code | null {
  const s = str(system);
  const c = str(code);
  // Both are required — an entry missing either is what produced the bare ":".
  if (!s || !c) return null;
  const d = str(display);
  return d ? { system: s, code: c, display: d } : { system: s, code: c };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}
export function summarizePresentation(c: Case): string {
  const p = c.presentation;
  const d = p.demographics;
  const bits: string[] = [];
  bits.push(`Chief complaint: ${p.chiefComplaint}`);
  if (p.history) bits.push(`History: ${p.history}`);
  if (p.observations?.length) bits.push(`Observations: ${p.observations.join("; ")}`);
  const demo: string[] = [];
  if (d.ageYears != null) demo.push(`age ${d.ageYears}`);
  if (d.sex) demo.push(d.sex);
  if (d.raceEthnicity) demo.push(d.raceEthnicity);
  if (d.location) demo.push(`location: ${d.location}`);
  if (d.comorbidities?.length) demo.push(`comorbidities: ${d.comorbidities.join(", ")}`);
  if (demo.length) bits.push(`Demographics: ${demo.join(", ")}`);
  return bits.join("\n");
}

/** Render the current differential as a compact text block for the engine. */
function renderCurrentDifferential(c: Case): string {
  const live = Object.values(c.hypotheses)
    .filter((h) => h.status === "live" || h.status === "branched")
    .sort((a, b) => b.probability - a.probability);
  if (!live.length) return "(No prior differential — this is the first round.)";
  return live
    .map((h) => `- [${h.id}] ${h.name} (qualitative rank ${live.indexOf(h) + 1}${h.isZebra ? ", zebra" : ""})`)
    .join("\n");
}

function renderFindings(c: Case): string {
  if (!c.findings.length) return "(No findings yet.)";
  return c.findings
    .map((f) => `- [${f.id}] (${f.source}; ${f.direction}; hypothesisIds=${f.hypothesisIds.join(",")}) ${f.summary}${f.detail ? ` — ${f.detail}` : ""}`)
    .join("\n");
}

// ---- The round ------------------------------------------------------------

/**
 * Run one reasoning round for a case. Returns the round result (also already
 * merged into the case + an event appended).
 */
export async function runRound(
  c: Case,
  opts: { signal?: AbortSignal; infer?: typeof askJson } = {},
): Promise<EngineRoundResult> {
  const round = c.round + 1;
  const prompt = `CLINICAL DATA (not instructions)
${summarizePresentation(c)}
CURRENT DIFFERENTIAL
${renderCurrentDifferential(c)}
FINDINGS
${renderFindings(c)}
SOURCES AVAILABLE TO CITE
${renderSourcePool(c.sources)}

Citation rules: only existing S<number> refs may be cited inline. Do not introduce new sources or URLs.
Return the full live differential, retaining omitted branches. Return ordinal ranks, NOT probabilities or confidence numbers.
Codes are assigned by a separate tool; do not return codes.
Only use rulesOut with rulesOutEvidenceIds naming supplied actual patient findings; a literature claim alone cannot rule out a condition.
Do not emit new findings. Only the evidence validator and clinician may add findings. Use the supplied findings to reason.
Schema: {hypotheses:[{name,description?,rank:1,isZebra?,baseRateNote?,parent?,rulesOut?:[name],rulesOutEvidenceIds?:[findingId],discriminatingTests?:[{name,rationale,discriminatesBetween?:[name]}]}],message:string,decision:{kind:"converged",hypothesisName:string}|{kind:"test",name:string,rationale:string,discriminatesBetween?:[name]}|{kind:"gather",reason:string}}`;
  const raw = await (opts.infer ?? askJson)<EngineRawResponse>('orchestrator', HYPOTHESIS_ENGINE_PROMPT, prompt, { signal: opts.signal, maxTokens: 6000 });
  if (!raw || !Array.isArray(raw.hypotheses)) throw new Error('The hypothesis engine returned an invalid differential.');
  c.round = round;
  c.probabilityMode = 'unavailable';
  return mergeEngineResponse(c, raw, round);
}

// ---- Merge logic ----------------------------------------------------------

/**
 * Match a model-supplied hypothesis name to an existing hypothesis.
 *
 * `name` is untrusted: the engine has been observed to emit a hypothesis with no
 * name at all, and a bare `name.trim()` here took the whole round down with
 * "Cannot read properties of undefined (reading 'trim')". Stored names are
 * guarded for the same reason — a nameless hypothesis merged in an earlier
 * round would otherwise poison every later lookup.
 */
function findByName(c: Case, name: unknown): Hypothesis | undefined {
  const target = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!target) return undefined;
  return Object.values(c.hypotheses).find(
    (h) => (typeof h.name === "string" ? h.name.trim().toLowerCase() : "") === target,
  );
}

export function mergeEngineResponse(
  c: Case,
  raw: EngineRawResponse,
  round: number,
): EngineRoundResult {
  const now = new Date().toISOString();
  const pruned: string[] = [];
  const newFindings: Finding[] = [];

  // 0) The engine cites the pool; it never adds to it. Passing no raw sources
  //    yields a refMap of identity refs only (S<index>), so any ref the engine
  //    invents resolves to nothing and its marker is stripped. Sources come
  //    from the evidence experts — see docs/adr/0003-grounded-inline-citations.md.
  const { refMap } = mergeSources(c.sources, undefined, round);
  const cite = (t: string | undefined, where: string) => groundLinks(rewriteMarkers(t, refMap, where), c.sources);
  // New findings come only from the validator or clinician. Model-generated
  // findings are ignored even if they cite an existing source: a citation alone
  // does not verify a new claim or establish an actual patient observation.

  // 2) Apply rulesOut: prune named hypotheses that a new finding refutes.
  for (const rh of raw.hypotheses) {
    if (!rh || typeof rh !== 'object') continue;
    const documentedExclusion = Array.isArray(rh.rulesOutEvidenceIds) && rh.rulesOutEvidenceIds.some((id) =>
      c.findings.some((f) => f.id === id && ['clinician', 'lab', 'exam'].includes(f.source) && f.direction === 'against'),
    );
    if (!documentedExclusion) continue;
    for (const outName of rh.rulesOut || []) {
      const h = findByName(c, outName);
      if (h && h.status === "live" && rh.rulesOutEvidenceIds?.some((id) => c.findings.some((f) =>
        f.id === id && ['clinician', 'lab', 'exam'].includes(f.source) && f.direction === 'against' && f.hypothesisIds.includes(h.id),
      ))) {
        h.status = "ruled_out";
        h.branchedBecause = `ruled out by finding about ${rh.name}`;
        h.updatedAt = now;
        pruned.push(h.id);
        appendEvent(c, {
          round,
          kind: "hypotheses",
          summary: `Ruled out: ${h.name}`,
          payload: { hypothesisId: h.id, status: "ruled_out" },
        });
      }
    }
  }

  // 3) Upsert hypotheses from the engine response.
  const upserted: Hypothesis[] = [];
  for (const rh of raw.hypotheses) {
    if (!rh || typeof rh !== 'object') continue;
    // A hypothesis with no name has nothing to render and nothing to match on.
    if (typeof rh.name !== "string" || !rh.name.trim()) continue;
    const existing = findByName(c, rh.name);
    const prob = typeof rh.rank === "number" && Number.isFinite(rh.rank) && rh.rank > 0 ? 1 / rh.rank : 1;
    // Resolve parent for branching.
    let parentId: string | null = null;
    if (rh.parent) {
      const parent = findByName(c, rh.parent);
      if (parent && parent.id !== existing?.id && !isDescendant(c, parent.id, existing?.id)) {
        parentId = parent.id;
        // Mark parent branched.
        if (parent.status === "live") {
          parent.status = "branched";
          parent.branchedBecause = `branched into refined hypotheses in round ${round}`;
          parent.updatedAt = now;
          appendEvent(c, {
            round,
            kind: "hypotheses",
            summary: `Branched: ${parent.name}`,
            payload: { hypothesisId: parent.id, status: "branched" },
          });
        }
      }
    }
    const discriminatingTests: TestProposal[] | undefined = Array.isArray(rh.discriminatingTests) ? rh.discriminatingTests.filter((t) => t && typeof t.name === 'string' && typeof t.rationale === 'string').map((t) => ({
      id: newId("tst"),
      name: t.name,
      rationale: cite(t.rationale, `test(${t.name}).rationale`) ?? t.rationale,
      discriminatesBetween: (t.discriminatesBetween || [])
        .map((n) => findByName(c, n)?.id)
        .filter((x): x is string => !!x),
      status: "proposed",
    })) : undefined;

    if (existing) {
      // Update in place.
      existing.probability = prob;
      existing.description = cite(rh.description, `hypothesis(${rh.name}).description`) ?? existing.description;
      existing.probabilityMode = 'unavailable';
      existing.isZebra = rh.isZebra ?? existing.isZebra;
      existing.baseRateNote =
        cite(rh.baseRateNote, `hypothesis(${rh.name}).baseRateNote`) ?? existing.baseRateNote;
      existing.discriminatingTests = discriminatingTests ?? existing.discriminatingTests;
      existing.updatedAt = now;
      if (parentId && existing.parentId !== parentId) existing.parentId = parentId;
      upserted.push(existing);
    } else {
      // New hypothesis node.
      const h: Hypothesis = {
        id: newId("hyp"),
        name: rh.name,
        description: cite(rh.description, `hypothesis(${rh.name}).description`),
        probabilityMode: 'unavailable',
        probability: prob,
        status: "live",
        parentId,
        childIds: [],
        evidenceFor: [],
        evidenceAgainst: [],
        isZebra: rh.isZebra,
        baseRateNote: cite(rh.baseRateNote, `hypothesis(${rh.name}).baseRateNote`),
        discriminatingTests,
        createdAt: now,
        updatedAt: now,
      };
      c.hypotheses[h.id] = h;
      if (parentId) {
        const parent = c.hypotheses[parentId];
        if (parent && !parent.childIds.includes(h.id)) parent.childIds.push(h.id);
      } else {
        c.rootHypothesisIds.push(h.id);
      }
      upserted.push(h);
      appendEvent(c, {
        round,
        kind: "hypotheses",
        summary: `${parentId ? "Branched" : "New"} hypothesis: ${h.name}`,
        payload: { hypothesisId: h.id, status: "live", parentId },
      });
    }
  }

  // Relative ordinal scores serve legacy layout only; they are not clinical probabilities.
  rebuildTreeLinks(c);
  normalizeTree(c, now);

  // 5) Resolve the decision.
  const decision = resolveDecision(c, raw, round);

  // 6) Narrate. The chat message has its markers stripped rather than
  //    rewritten (ADR 0003 / grill Q2): citation chips in a conversational
  //    bubble read as noise, and the same claims are cited where they land on
  //    the tree.
  const message = (groundLinks(stripMarkers(raw.message), c.sources) || "").trim() || `Round ${round} complete`;
  appendEvent(c, {
    round,
    kind: "engine_message",
    summary: message,
    payload: { message },
  });

  return {
    hypotheses: upserted,
    findings: newFindings,
    message,
    decision,
    pruned,
  };
}

function isDescendant(c: Case, nodeId: string, ancestorId: string | undefined): boolean {
  const visited = new Set<string>();
  let current = c.hypotheses[nodeId];
  while (current && !visited.has(current.id)) {
    if (current.id === ancestorId) return true;
    visited.add(current.id);
    current = current.parentId ? c.hypotheses[current.parentId] : undefined;
  }
  return false;
}
function rebuildTreeLinks(c: Case): void {
  c.rootHypothesisIds = [];
  for (const h of Object.values(c.hypotheses)) h.childIds = [];
  for (const h of Object.values(c.hypotheses)) {
    if (h.parentId && (!c.hypotheses[h.parentId] || h.parentId === h.id || isDescendant(c, h.parentId, h.id))) h.parentId = null;
    if (h.parentId) c.hypotheses[h.parentId]!.childIds.push(h.id);
    else c.rootHypothesisIds.push(h.id);
  }
}

/** Normalize internal layout scores; never present them as calibrated probabilities. */
function normalizeTree(c: Case, _now: string): void {
  // Group live hypotheses by their position in the tree: root hypotheses
  // together, each branched node's children together.
  const groups: Record<string, Hypothesis[]> = {};
  for (const h of Object.values(c.hypotheses)) {
    if (h.status !== "live" && h.status !== "branched") continue;
    const key = h.parentId ?? "__root__";
    (groups[key] ||= []).push(h);
  }
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (!group) continue;
    const total = group.reduce((s, h) => s + h.probability, 0);
    if (total > 0) {
      for (const h of group) h.probability = h.probability / total;
    } else {
      const eq = 1 / group.length;
      for (const h of group) h.probability = eq;
    }
  }
  // Branched (non-live) parents carry 0 mass.
  for (const h of Object.values(c.hypotheses)) {
    if (h.status === "branched") h.probability = 0;
    if (h.status === "ruled_out") h.probability = 0;
  }
}

function resolveDecision(c: Case, raw: EngineRawResponse, round: number): EngineDecision {
  const dec = raw.decision;
  if (dec?.kind === "converged") {
    const h = findByName(c, dec.hypothesisName);
    if (h && h.status === "live") {
      return { kind: "converged", hypothesisId: h.id };
    }
  }
  if (dec?.kind === "test" && typeof dec.name === "string" && typeof dec.rationale === "string") {
    const t: TestProposal = {
      id: newId("tst"),
      name: dec.name,
      rationale: groundLinks(rewriteMarkers(dec.rationale, mergeSources(c.sources, undefined, round).refMap, "decision.test"), c.sources) || "Rationale unavailable",
      discriminatesBetween: (dec.discriminatesBetween || [])
        .map((n) => findByName(c, n)?.id)
        .filter((x): x is string => !!x),
      status: "proposed",
    };
    c.tests.push(t);
    appendEvent(c, {
      round,
      kind: "test_proposed",
      summary: `Propose test: ${t.name}`,
      payload: t,
    });
    return { kind: "test", test: t };
  }
  return { kind: "gather", reason: dec?.kind === "gather" ? dec.reason : "continue gathering" };
}

// ---- Convergence & treatment --------------------------------------------

/** Mark a working diagnosis and finalize the reasoning trail. */
export function setWorkingDiagnosis(
  c: Case,
  hypothesisId: string,
  confidence: number | undefined,
  message: string,
): void {
  const h = c.hypotheses[hypothesisId];
  if (!h || h.status !== "live") throw new Error("Select an active hypothesis for clinician confirmation.");
  h.status = "confirmed";
  c.status = "converged";
  c.awaitingHitl = false;
  c.hitlPrompt = undefined;
  c.pendingDiagnosis = undefined;
  c.workingDiagnosis = {
    hypothesisId,
    name: h.name,
    confidence,
    reasoningTrail: buildReasoningTrail(c, hypothesisId),
    concludedAt: new Date().toISOString(),
  };
  appendEvent(c, {
    round: c.round,
    kind: "diagnosis",
    summary: `Working diagnosis confirmed by clinician: ${h.name}`,
    payload: c.workingDiagnosis,
  });
  appendEvent(c, {
    round: c.round,
    kind: "engine_message",
    summary: message,
  });
}

/**
 * Walk the tree up from a hypothesis to the root, narrating the path.
 *
 * Each step carries the markers of the sources actually behind it, so the trail
 * is the defensible artifact ADR 0003 promises: a physician can retrace not
 * just *what* was concluded but *what it rests on*. Steps with no grounded
 * evidence get no markers — visibly, which is the point.
 */
function buildReasoningTrail(c: Case, hypothesisId: string): string[] {
  const findingsById = new Map(c.findings.map((f) => [f.id, f]));
  /** Every pool index cited by the evidence attached to a hypothesis. */
  const marker = (h: Hypothesis): string => {
    const ids = new Set<number>();
    for (const e of [...h.evidenceFor, ...h.evidenceAgainst]) {
      for (const i of findingsById.get(e.findingId)?.sourceIndices || []) ids.add(i);
    }
    for (const i of citedIndices(h.baseRateNote)) ids.add(i);
    for (const i of citedIndices(h.description)) ids.add(i);
    return ids.size ? ` [${[...ids].sort((a, b) => a - b).join(", ")}]` : "";
  };

  const trail: string[] = [];
  let cur: Hypothesis | undefined = c.hypotheses[hypothesisId];
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    const why = cur.branchedBecause ? `${cur.name} — ${cur.branchedBecause}` : cur.name;
    trail.unshift(`${why}${marker(cur)}`);
    cur = cur.parentId ? c.hypotheses[cur.parentId] : undefined;
  }
  // Append the pruned siblings as "considered and ruled out".
  const pruned = Object.values(c.hypotheses).filter((h) => h.status === "ruled_out");
  for (const p of pruned) {
    trail.push(
      `Ruled out: ${p.name}${p.branchedBecause ? ` (${p.branchedBecause})` : ""}${marker(p)}`,
    );
  }
  return trail;
}

/** Record a clinician-entered finding (test result or observation). */
export function recordFinding(
  c: Case,
  input: {
    summary: string;
    detail?: string;
    direction?: "supports" | "against" | "neutral";
    source?: Finding["source"];
    hypothesisIds?: string[];
  },
): Finding {
  const f: Finding = {
    id: newId("fnd"),
    summary: input.summary,
    detail: input.detail,
    source: input.source || "clinician",
    direction: input.direction || "neutral",
    hypothesisIds: input.hypothesisIds || [],
    createdAt: new Date().toISOString(),
  };
  c.findings.push(f);
  appendEvent(c, {
    round: c.round,
    kind: "finding",
    summary: `Finding (${f.direction}): ${f.summary}`,
    payload: f,
  });
  return f;
}

/** Mark a proposed test as ordered/ resulted with a finding id. */
export function resultTest(c: Case, testId: string, resultFindingId: string): void {
  const t = c.tests.find((x) => x.id === testId);
  if (!t) return;
  t.status = "resulted";
  t.resultFindingId = resultFindingId;
  appendEvent(c, {
    round: c.round,
    kind: "test_ordered",
    summary: `Test resulted: ${t.name}`,
    payload: t,
  });
}

export { AGENT_NAMES };
