import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../index.js';
import { createCase } from './case-factory.js';
import { store } from './case-store.js';
import { mergeEngineResponse } from './engine.js';
import { MissingAnthropicKeyError } from '../anthropic/runtime.js';
import type { Case, EngineRoundResult } from './types.js';

const emptyEvidence = async () => ({ sources: [], findings: [], status: 'unavailable' as const, limitations: ['Mock retrieval unavailable'] });
const emptyCodes = async (request: { requestId: string }) => ({ requestId: request.requestId, system: 'ICD-10-GM' as const, edition: '2026' as const, results: [], searchProvidersUsed: [], limitations: [] });
const caseOf = () => createCase({ chiefComplaint: 'Test presentation', observations: [], demographics: {} });
function proposed(c: Case): EngineRoundResult {
  c.round += 1;
  return mergeEngineResponse(c, { hypotheses: [{ name: 'Candidate A', rank: 1 }], message: 'Review candidate A', decision: { kind: 'converged', hypothesisName: 'Candidate A' } }, c.round);
}
async function serve(overrides: Parameters<typeof createApp>[0], fn: (url: string) => Promise<void>) {
  const server = createApp(overrides).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  try { await fn(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
}
const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const mockServices = { requireInference: () => 'mock-only', fetchEvidence: emptyEvidence, assignMedicalCodes: emptyCodes };

test('server boots without key and live inference returns structured 503 without mutation', async () => {
  const c = caseOf();
  const before = structuredClone(c);
  await serve({ requireInference: () => { throw new MissingAnthropicKeyError(); } }, async (url) => {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    const response = await post(`${url}/api/cases/${c.id}/advance`);
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.ok(payload && typeof payload === 'object' && 'code' in payload);
    assert.equal(payload.code, 'ANTHROPIC_KEY_MISSING');
  });
  assert.deepEqual(c, before);
});

test('model convergence is a proposal; only explicit clinician selection confirms it', async () => {
  const c = caseOf();
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft) }, async (url) => {
    const first = await post(`${url}/api/cases/${c.id}/advance`);
    assert.equal(first.status, 200);
    assert.equal(c.workingDiagnosis, undefined);
    assert.equal(c.awaitingHitl, true);
    assert.ok(c.pendingDiagnosis?.hypothesisId);
    assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 409);
    assert.equal((await post(`${url}/api/cases/${c.id}/diagnose`, {})).status, 400);
    assert.equal((await post(`${url}/api/cases/${c.id}/diagnose`, { hypothesisId: 'unknown' })).status, 400);
    const response = await post(`${url}/api/cases/${c.id}/diagnose`, { hypothesisId: c.pendingDiagnosis?.hypothesisId, confidence: 0.999 });
    assert.equal(response.status, 200);
    const diagnosis = store.get(c.id)?.workingDiagnosis;
    assert.equal(diagnosis?.name, 'Candidate A');
    assert.equal(diagnosis?.confidence, undefined);
    assert.equal(c.pendingDiagnosis, undefined);
  });
});

test('failed round rolls back sources, findings, round and history; retry commits once', async () => {
  const c = caseOf();
  const before = structuredClone(c);
  let calls = 0;
  await serve({ ...mockServices, runRound: async (draft) => {
    if (++calls === 1) { proposed(draft); throw new Error('mock model failure after local merge'); }
    return proposed(draft);
  } }, async (url) => {
    assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 502);
    assert.deepEqual(c, before);
    assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 200);
    assert.equal(c.round, 1);
    assert.equal(c.history.filter((f) => f.kind === 'round').length, 1);
    assert.equal(Object.keys(c.hypotheses).length, 1);
  });
});

test('in-flight round locks other mutations and duplicate advances', async () => {
  const c = caseOf();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await serve({ ...mockServices, runRound: async (draft) => { entered(); await gate; return proposed(draft); } }, async (url) => {
    const running = post(`${url}/api/cases/${c.id}/advance`);
    await started;
    try {
      assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 409);
      assert.equal((await post(`${url}/api/cases/${c.id}/finding`, { summary: 'Concurrent' })).status, 409);
      assert.equal((await fetch(`${url}/api/cases/${c.id}`, { method: 'DELETE' })).status, 409);
    } finally { release(); }
    assert.equal((await running).status, 200);
    assert.equal(c.round, 1);
  });
});

test('unknown test ID never records a finding; unrelated finding keeps test gate closed', async () => {
  const c = caseOf(); c.awaitingHitl = true;
  c.tests.push({ id: 'real-test', name: 'Requested test', rationale: 'Discriminate', status: 'proposed', discriminatesBetween: [] });
  const before = structuredClone(c);
  await serve({}, async (url) => {
    assert.equal((await post(`${url}/api/cases/${c.id}/finding`, { summary: 'Result', testId: 'bad-id' })).status, 400);
    assert.deepEqual(c, before);
    assert.equal((await post(`${url}/api/cases/${c.id}/finding`, { summary: 'Unrelated observation' })).status, 200);
    assert.equal(c.awaitingHitl, true);
    assert.equal((await post(`${url}/api/cases/${c.id}/finding`, { summary: 'Actual result', testId: 'real-test' })).status, 200);
    assert.equal(c.awaitingHitl, false);
    const count = c.findings.length;
    assert.equal((await post(`${url}/api/cases/${c.id}/finding`, { summary: 'Duplicate', testId: 'real-test' })).status, 409);
    assert.equal(c.findings.length, count);
  });
});

test('ruled-out hypothesis cannot be confirmed', async () => {
  const c = caseOf(); proposed(c);
  const h = Object.values(c.hypotheses)[0]!; h.status = 'ruled_out';
  await serve({}, async (url) => { assert.equal((await post(`${url}/api/cases/${c.id}/diagnose`, { hypothesisId: h.id })).status, 400); });
  assert.equal(c.workingDiagnosis, undefined);
});

test('verified coding suggestions retain their clickable reference and rationale in case history', async () => {
  const c = caseOf();
  const url = 'https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/block-i10-i15.htm';
  const rationale = 'Synthetic coding contract fixture; not a clinical coding answer.';
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft), assignMedicalCodes: async (request) => ({
    ...await emptyCodes(request),
    results: [{
      condition: 'Candidate A', hypothesisId: request.hypotheses![0]!.id,
      status: 'assigned', code: 'I10.90', officialLabel: 'Fixture label', rationale,
      inputRefs: ['presentation'], clarificationQuestions: [],
      references: [{ url, supportingPassage: 'Synthetic official-source adapter fixture', retrievedAt: '2026-10-17T00:00:00.000Z', retrievalProvider: 'tavily' }],
    }],
  }) }, async (base) => {
    assert.equal((await post(`${base}/api/cases/${c.id}/advance`)).status, 200);
    const code = Object.values(c.hypotheses)[0]!.codes![0]!;
    assert.equal(code.url, url);
    assert.equal(code.reasoning, rationale);
    const frame = c.history.find((h) => h.kind === 'round')!;
    assert.equal(Object.values(frame.hypotheses)[0]!.codes![0]!.url, url);
    assert.equal(c.workingDiagnosis, undefined);
  });
});
