import { researchEvidence, type ExpertEvidenceResult } from "../experts/index.js";
import { appendEvent, newId } from "./case-store.js";
import { mergeSources, resolveRefs, rewriteMarkers, type RawSource } from "./sources.js";
import type { Case, Finding, Source } from "./types.js";

type RawEvidence = ExpertEvidenceResult;

export interface EvidencePassResult {
  sources: Source[];
  findings: Finding[];
}

const EMPTY: EvidencePassResult = { sources: [], findings: [] };

/** As engine.ts's namesake: `name` comes from the model and may be absent. */
function findByName(c: Case, name: unknown) {
  const target = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!target) return undefined;
  return Object.values(c.hypotheses).find(
    (h) => (typeof h.name === "string" ? h.name.trim().toLowerCase() : "") === target,
  );
}

/** Fetch once before the current round; tools mutate no case state. */
export async function fetchEvidence(c: Case, opts: { signal?: AbortSignal } = {}): Promise<RawEvidence> {
  try { return await researchEvidence(c, opts); }
  catch (error) {
    if (opts.signal?.aborted) throw error;
    return { sources: [], findings: [], status: 'unavailable', limitations: ['Evidence retrieval failed.'] };
  }
}

/**
 * Fold a fetched evidence result into the Case: merge its sources into the
 * pool, rewrite its prose markers to stable indices, and attach its findings to
 * the hypotheses they bear on. Synchronous and idempotent-per-call — run it
 * exactly once per staged round, before the hypothesis engine's prompt.
 */
export function applyEvidence(c: Case, raw: RawEvidence | null): EvidencePassResult {
  if (!raw) return EMPTY;

  const { refMap, added } = mergeSources(c.sources, raw.sources, c.round);
  const now = new Date().toISOString();
  const findings: Finding[] = [];

  for (const rf of raw.findings || []) {
    if (!rf || typeof rf.summary !== 'string' || !rf.summary.trim()) continue;
    if (rf.validationStatus !== 'supported') continue;
    if (c.findings.some((f) => f.summary === rf.summary.trim() && f.source === 'literature')) continue;
    const sourceIndices = resolveRefs(refMap, rf.sourceRefs || []);
    // A literature finding with no resolvable source is an unbacked assertion
    // from an agent whose whole job is to bring back sources. Drop it.
    if (!sourceIndices.length) continue;

    // The orchestrator may also cite inline, in its own local refs. Same rule
    // as the engine: rewrite to pool indices, strip whatever doesn't resolve.
    const summary = rewriteMarkers(rf.summary.trim(), refMap, "evidence finding.summary")!;
    const detail = rewriteMarkers(rf.detail?.trim() || undefined, refMap, "evidence finding.detail");

    const f: Finding = {
      id: newId("fnd"),
      summary,
      detail,
      source: "literature",
      direction: rf.direction || "neutral",
      hypothesisIds: [],
      sourceIndices,
      validationStatus: rf.validationStatus,
      createdAt: now,
    };
    for (const hn of rf.hypothesisNames || []) {
      const h = findByName(c, hn);
      if (h && !f.hypothesisIds.includes(h.id)) f.hypothesisIds.push(h.id);
    }
    c.findings.push(f);
    findings.push(f);

    // Link the finding onto the hypotheses it bears on, same as the engine does.
    for (const hid of f.hypothesisIds) {
      const h = c.hypotheses[hid];
      if (!h) continue;
      if (f.direction === "supports" && !h.evidenceFor.some((e) => e.findingId === f.id)) {
        h.evidenceFor.push({ findingId: f.id, weight: f.summary });
      } else if (f.direction === "against" && !h.evidenceAgainst.some((e) => e.findingId === f.id)) {
        h.evidenceAgainst.push({ findingId: f.id, weight: f.summary });
      }
    }
  }

  if (added.length || findings.length) {
    appendEvent(c, {
      round: c.round,
      kind: "finding",
      summary: `Evidence pass: ${added.length} new source${added.length === 1 ? "" : "s"}, ${findings.length} grounded finding${findings.length === 1 ? "" : "s"}`,
      payload: { sources: added, findings },
    });
  }
  return { sources: added, findings };
}

/** Link this round's already-stored evidence once newly generated hypotheses exist. */
export function attachEvidenceTargets(c: Case, raw: RawEvidence | null): void {
  if (!raw) return;
  const { refMap } = mergeSources(c.sources, raw.sources, c.round);
  for (const rf of raw.findings) {
    if (rf.validationStatus !== 'supported') continue;
    const summary = rewriteMarkers(rf.summary?.trim(), refMap, 'evidence link');
    const f = c.findings.find((finding) => finding.source === 'literature' && finding.summary === summary);
    if (!f) continue;
    for (const name of rf.hypothesisNames || []) {
      const h = findByName(c, name);
      if (!h) continue;
      if (!f.hypothesisIds.includes(h.id)) f.hypothesisIds.push(h.id);
      const refs = f.direction === 'supports' ? h.evidenceFor : f.direction === 'against' ? h.evidenceAgainst : undefined;
      if (refs && !refs.some((ref) => ref.findingId === f.id)) refs.push({ findingId: f.id, weight: f.summary });
    }
  }
}
