/**
 * Guards on untrusted model output in the merge path. Both cases here were
 * real: the engine returned codes as bare strings, and a hypothesis with no
 * name at all, each of which took down a live round.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalizeCodes } from "./engine.js";

test("normalizeCodes drops entries without a system and code", () => {
  assert.deepEqual(normalizeCodes([{ system: "ICD-10" }, { code: "I00" }, {}]), undefined);
  assert.deepEqual(normalizeCodes([":", "   ", null, 42]), undefined);
});

test("normalizeCodes recovers the bare-string form the engine emits", () => {
  assert.deepEqual(normalizeCodes(["ICD-10:I00"]), [{ system: "ICD-10", code: "I00" }]);
  assert.deepEqual(normalizeCodes(["SNOMED: 373170000 Viral arthropathy"]), [
    { system: "SNOMED", code: "373170000", display: "Viral arthropathy" },
  ]);
});

test("normalizeCodes keeps good entries alongside bad ones", () => {
  assert.deepEqual(normalizeCodes([":", { system: "ICD-10", code: "I00" }]), [
    { system: "ICD-10", code: "I00" },
  ]);
});

test("normalizeCodes ignores a non-array", () => {
  assert.equal(normalizeCodes("ICD-10:I00"), undefined);
  assert.equal(normalizeCodes(undefined), undefined);
});

import { createCase } from './case-factory.js';
import { mergeEngineResponse, recordFinding } from './engine.js';

const caseOf = () => createCase({ chiefComplaint: 'Test', demographics: {}, observations: [] });
const gathered = { kind: 'gather' as const, reason: 'More evidence required' };
test('ordinal rankings retain omitted diagnoses and never become clinical probabilities', () => {
  const c = caseOf();
  mergeEngineResponse(c, { hypotheses: [{ name: 'Common', rank: 1 }, { name: 'Rare', rank: 1000, isZebra: true }], message: 'Ranked', decision: gathered }, 1);
  mergeEngineResponse(c, { hypotheses: [{ name: 'Common', rank: 1, rulesOut: ['Rare'] }], message: 'Updated', decision: gathered }, 2);
  const rare = Object.values(c.hypotheses).find((h) => h.name === 'Rare');
  assert.equal(rare?.status, 'live');
  assert.equal(rare?.probabilityMode, 'unavailable');
  assert.equal(Object.values(c.hypotheses).length, 2);
});

test('rule-out requires an against finding linked to the excluded hypothesis', () => {
  const c = caseOf();
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', rank: 1 }, { name: 'B', rank: 2 }], message: 'Initial', decision: gathered }, 1);
  const a = Object.values(c.hypotheses).find((h) => h.name === 'A')!;
  const b = Object.values(c.hypotheses).find((h) => h.name === 'B')!;
  const f = recordFinding(c, { summary: 'Clinician documented exclusion', direction: 'against', hypothesisIds: [a.id] });
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', rank: 1, rulesOut: ['B'], rulesOutEvidenceIds: [f.id] }], message: 'Unrelated evidence', decision: gathered }, 2);
  assert.equal(b.status, 'live');
  mergeEngineResponse(c, { hypotheses: [{ name: 'B', rank: 1, rulesOut: ['A'], rulesOutEvidenceIds: [f.id] }], message: 'Related evidence', decision: gathered }, 3);
  assert.equal(a.status, 'ruled_out');
  assert.ok(c.hypotheses[a.id]);
});

test('self-parent and circular model branches never create a malformed tree', () => {
  const c = caseOf();
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', rank: 1 }, { name: 'B', rank: 2 }], message: 'Initial', decision: gathered }, 1);
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', parent: 'B', rank: 1 }, { name: 'B', parent: 'A', rank: 2 }], message: 'Cycle attempt', decision: gathered }, 2);
  for (const h of Object.values(c.hypotheses)) {
    const visited = new Set<string>();
    let current: typeof h | undefined = h;
    while (current) {
      assert.equal(visited.has(current.id), false);
      visited.add(current.id);
      if (current.parentId) assert.ok(c.hypotheses[current.parentId]?.childIds.includes(current.id));
      current = current.parentId ? c.hypotheses[current.parentId] : undefined;
    }
  }
  assert.ok(c.rootHypothesisIds.length);
});

test('orchestrator cannot assign codes from memory', () => {
  const c = caseOf();
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', rank: 1, codes: [{ system: 'invented', code: '123' }] }], message: 'No verified code tool', decision: gathered }, 1);
  assert.equal(Object.values(c.hypotheses)[0]?.codes, undefined);
});

test('orchestrator cannot turn a cited model assertion into a patient or validated finding', () => {
  const c = caseOf();
  c.sources.push({ index: 1, title: 'Actual source', url: 'https://example.org/paper', type: 'paper', addedRound: 1 });
  mergeEngineResponse(c, { hypotheses: [{ name: 'A', rank: 1 }], findings: [{ summary: 'Invented patient observation [S1]', source: 'lab', sourceRefs: ['S1'] }], message: 'Reasoning', decision: gathered }, 1);
  assert.equal(c.findings.length, 0);
});
