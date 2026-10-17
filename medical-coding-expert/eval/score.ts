// Compares one pipeline response with a case's expectations. Pure: no I/O.

import type { CodingResponse, CodingResult } from "../src/types.ts";
import { CATALOGUE_BASE } from "../src/urlPolicy.ts";
import type { CaseScore, EvalCase, ExpectedResult, Match } from "./types.ts";

export const norm = (code: string) => code.trim().toUpperCase().replace(/[-!*†]+$/, "").replace(/\.$/, "");
const hasPrefix = (code: string, prefixes: string[] = []) => prefixes.find((p) => norm(code).startsWith(norm(p)));
const inList = (code: string, list: string[] = []) => list.some((c) => norm(c) === norm(code));

/** Codes must never be assigned for these mentions, whatever the case expects. */
const NEVER_ASSIGNED = new Set(["negated", "family_history", "literature_only", "suspected"]);

function matchScore(e: ExpectedResult, r: CodingResult): number {
  let score = 0;
  if (e.match.hypothesisId && r.hypothesisId === e.match.hypothesisId) score += 4;
  const condition = r.condition.toLowerCase();
  if (e.match.conditionIncludes?.some((k) => condition.includes(k.toLowerCase()))) score += 2;
  if (e.match.inputRefs?.some((id) => r.inputRefs.includes(id))) score += 1;
  return score;
}

/** Greedy best-score matching, strongest pairs first, each result used once. */
function matchResults(c: EvalCase, results: CodingResult[]): Match[] {
  const pairs = c.expected
    .flatMap((e, ei) => results.map((r, ri) => ({ ei, ri, s: matchScore(e, r) })))
    .filter((p) => p.s > 0)
    .sort((a, b) => b.s - a.s || a.ei - b.ei || a.ri - b.ri);
  const byExpected = new Map<number, number>();
  const used = new Set<number>();
  for (const p of pairs) {
    if (byExpected.has(p.ei) || used.has(p.ri)) continue;
    byExpected.set(p.ei, p.ri);
    used.add(p.ri);
  }
  return c.expected.map((e, ei) => ({ expectedId: e.id, resultIndex: byExpected.get(ei) ?? null }));
}

function checkInvariants(r: CodingResult, i: number, inputIds: Set<string>, fail: (m: string) => void) {
  const tag = `result[${i}] "${r.condition}"`;
  if (r.status === "unavailable") fail(`${tag}: pipeline returned unavailable (${r.rationale})`);
  const unknown = r.inputRefs.filter((id) => !inputIds.has(id));
  if (unknown.length) fail(`${tag}: unknown inputRefs ${unknown.join(", ")}`);
  if (r.status !== "assigned") return;
  if (NEVER_ASSIGNED.has(r.assertion)) fail(`${tag}: ${r.assertion} mention was assigned ${r.code}`);
  if (!r.code || !r.officialLabel) fail(`${tag}: assigned without code or official label`);
  if (!r.inputRefs.length) fail(`${tag}: assigned without inputRefs`);
  if (!r.references.length) fail(`${tag}: assigned ${r.code} without a reference`);
  for (const ref of r.references) {
    if (!ref.url.startsWith(CATALOGUE_BASE)) fail(`${tag}: reference ${ref.url} is not a BfArM 2026 catalogue URL`);
    if (r.code && !norm(ref.supportingPassage).includes(norm(r.code)) && !ref.supportingPassage.toUpperCase().includes(norm(r.code)))
      fail(`${tag}: supporting passage does not contain ${r.code}`);
  }
}

function checkExpected(e: ExpectedResult, r: CodingResult, fail: (m: string) => void, warn: (m: string) => void, note: (m: string) => void) {
  const tag = `${e.id} ("${r.condition}")`;
  if (!e.assertion.includes(r.assertion)) fail(`${tag}: assertion ${r.assertion}, expected ${e.assertion.join(" | ")}`);
  if (!e.status.includes(r.status)) fail(`${tag}: status ${r.status}, expected ${e.status.join(" | ")}`);
  if (r.status === "assigned" && r.code) {
    const bad = hasPrefix(r.code, e.forbiddenCodes);
    if (bad) fail(`${tag}: assigned forbidden code ${r.code} (forbidden: ${bad})`);
    else if (e.acceptableCodes && !inList(r.code, e.acceptableCodes))
      fail(`${tag}: code ${r.code} not acceptable, expected ${e.acceptableCodes.join(" | ")}`);
  }
  if (r.status === "needs_clarification" && e.candidateCodes?.length) {
    const offered = [...(r.candidates ?? []).map((c) => c.code), ...(r.code ? [r.code] : [])];
    if (!offered.some((c) => inList(c, e.candidateCodes))) {
      warn(`${tag}: no expected candidate (${e.candidateCodes.join(" | ")}); offered ${offered.join(", ") || "none"}`);
    }
  }
  if (e.idealCode && !(r.status === "assigned" && r.code && norm(r.code) === norm(e.idealCode))) {
    note(`${tag}: acceptable, but the ideal code is ${e.idealCode} (got ${r.status}${r.code ? ` ${r.code}` : ""})`);
  }
  const missingRefs = (e.requiredInputRefs ?? []).filter((id) => !r.inputRefs.includes(id));
  if (missingRefs.length) fail(`${tag}: inputRefs missing ${missingRefs.join(", ")}`);
}

export function scoreCase(c: EvalCase, response: CodingResponse, queries: string[]): CaseScore {
  const failures: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const fail = (m: string) => failures.push(m);
  const warn = (m: string) => warnings.push(m);
  const note = (m: string) => notes.push(m);
  const { results } = response;

  if (response.requestId !== c.request.requestId) fail(`requestId ${response.requestId} does not echo ${c.request.requestId}`);
  if (response.system !== "ICD-10-GM" || response.edition !== "2026") fail(`wrong system/edition ${response.system} ${response.edition}`);

  const inputIds = new Set([...c.request.excerpts, ...c.request.evidence].map((x) => x.id));
  results.forEach((r, i) => checkInvariants(r, i, inputIds, fail));

  const matches = matchResults(c, results);
  matches.forEach((m, i) => {
    const e = c.expected[i]!;
    if (m.resultIndex === null) {
      if (e.required === false) note(`${e.id}: optional result not returned`);
      else fail(`${e.id}: expected result missing`);
      return;
    }
    checkExpected(e, results[m.resultIndex]!, fail, warn, note);
  });

  const matched = new Set(matches.map((m) => m.resultIndex));
  results.forEach((r, i) => {
    if (matched.has(i) || r.status !== "assigned" || !r.code) return;
    if (inList(r.code, c.allowedExtraCodes) || hasPrefix(r.code, c.allowedExtraCodePrefixes)) {
      warn(`extra assigned ${r.code} for "${r.condition}" (allowed)`);
    } else {
      fail(`unexpected assigned code ${r.code} for "${r.condition}"`);
    }
  });

  for (const r of results) {
    if (r.status === "assigned" && r.code) {
      const bad = hasPrefix(r.code, c.forbiddenAssignedCodes);
      if (bad) fail(`case-wide forbidden code ${r.code} assigned for "${r.condition}"`);
    }
    for (const cand of r.candidates ?? []) {
      if (hasPrefix(cand.code, c.forbiddenCandidateCodes)) fail(`forbidden candidate ${cand.code} offered for "${r.condition}"`);
    }
  }

  for (const term of c.forbiddenQueryTerms ?? []) {
    const leaked = queries.find((q) => q.toLowerCase().includes(term.toLowerCase()));
    if (leaked) fail(`patient identifier "${term}" leaked into web query: ${leaked}`);
  }

  const assignedCount = results.filter((r) => r.status === "assigned").length;
  if (c.maxAssigned !== undefined && assignedCount > c.maxAssigned) fail(`${assignedCount} codes assigned, at most ${c.maxAssigned} allowed`);

  return { caseId: c.id, passed: failures.length === 0, failures, warnings, notes, matches };
}
