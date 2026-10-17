import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../index.js';
import { createCase } from './case-factory.js';
import { store } from './case-store.js';
import { mergeEngineResponse, recordFinding, setWorkingDiagnosis } from './engine.js';
import { capture } from './history.js';
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

test('population rarity provenance is captured in history without enabling patient probabilities', async () => {
  const c = caseOf();
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft), annotateRarity: (draft) => {
    for (const h of Object.values(draft.hypotheses)) h.rarity = {
      status: 'matched', classification: 'below_reference_threshold', reason: 'Synthetic population fixture',
      entity: { orphaCode: '999', name: 'Candidate A', url: 'https://www.orpha.net/en/disease/detail/999' },
      geography: 'Germany', release: 'fixture', dataHash: 'fixture-hash',
    };
  } }, async (url) => {
    assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 200);
    const h = Object.values(c.hypotheses)[0]!;
    assert.equal(h.rarity?.dataHash, 'fixture-hash');
    assert.equal(c.probabilityMode, 'unavailable');
    const frame = c.history.at(-1)!;
    assert.equal(frame.hypotheses[h.id]?.rarity?.dataHash, 'fixture-hash');
    assert.equal((await fetch(`${url}/api/reference-data/rarity?name=`)).status, 400);
  });
});

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
      assert.equal((await post(`${url}/api/cases/${c.id}/forks`, { frameSeq: 0 })).status, 409);
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

test('fork copies the selected past step without future leakage and isolates parent, sibling and inherited history', async () => {
  const parent = caseOf();
  proposed(parent);
  parent.awaitingHitl = true;
  parent.pendingDiagnosis = undefined;
  parent.hitlPrompt = 'Enter the requested test result.';
  parent.tests.push({ id: 'past-test', name: 'Past proposed test', rationale: 'Fixture', status: 'proposed', discriminatesBetween: [] });
  parent.sources.push({ index: 1, title: 'Past source', url: 'https://example.org/past', type: 'web', addedRound: 1 });
  const hypothesis = Object.values(parent.hypotheses)[0]!;
  hypothesis.codes = [{ system: 'Fixture', code: 'TEST', url: 'https://example.org/code', reasoning: 'Retain reference metadata' }];
  recordFinding(parent, { summary: 'Original observed finding' });
  const past = capture(parent, 'round', 'Round one');
  parent.findings[0]!.detail = 'Future annotation that must not leak into an earlier event';
  recordFinding(parent, { summary: 'Future finding that must not leak' });
  parent.sources.push({ index: 2, title: 'Future source', url: 'https://example.org/future', type: 'web', addedRound: 2 });
  parent.tests.push({ id: 'future-test', name: 'Future test', rationale: 'Fixture', status: 'proposed', discriminatesBetween: [] });
  parent.round = 2;
  parent.probabilityCalculation = { status: 'computed', mode: 'illustrative', value: 0.9, prior: 0.1, likelihoodRatio: 81, modelId: 'future-fixture', modelVersion: '1' };
  capture(parent, 'round', 'Future round');
  let inferenceCalls = 0;
  await serve({ ...mockServices, runRound: async (draft) => { inferenceCalls++; return proposed(draft); } }, async (url) => {
    const before = await (await fetch(`${url}/api/cases/${parent.id}`)).json();
    const response = await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq: past.seq, snapshot: { findings: [{ summary: 'Forged client state' }] } });
    assert.equal(response.status, 201);
    const fork = await response.json() as Case;
    assert.notEqual(fork.id, parent.id);
    assert.equal(fork.forkOrigin?.parentCaseId, parent.id);
    assert.equal(fork.forkOrigin?.parentFrameSeq, past.seq);
    assert.equal(fork.round, 1);
    assert.deepEqual(fork.findings.map((f) => f.summary), ['Original observed finding']);
    assert.equal(fork.findings[0]!.hypothetical, undefined);
    assert.deepEqual(fork.sources.map((s) => s.url), ['https://example.org/past']);
    assert.deepEqual(fork.tests.map((t) => t.id), ['past-test']);
    assert.equal(fork.awaitingHitl, true);
    assert.equal(fork.history.length, past.seq + 2);
    assert.equal(fork.history.at(-1)?.kind, 'fork');
    assert.equal(Object.values(fork.hypotheses)[0]!.codes![0]!.url, 'https://example.org/code');
    assert.equal(fork.probabilityMode, 'unavailable');
    assert.equal(fork.probabilityCalculation?.status, 'unavailable');
    assert.ok(!JSON.stringify(fork.events).includes('Future finding'));
    assert.ok(!JSON.stringify(fork.events).includes('Future annotation'));
    assert.ok(!JSON.stringify(fork.history).includes('Future finding'));
    assert.equal(inferenceCalls, 0);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 409);
    const sibling = await (await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq: past.seq })).json() as Case;
    const changed = await post(`${url}/api/cases/${fork.id}/finding`, { summary: 'Assumed alternate result', testId: 'past-test', hypothetical: false });
    assert.equal(changed.status, 200);
    const updated = await changed.json() as Case;
    assert.equal(updated.findings.at(-1)?.hypothetical, true);
    assert.equal(updated.awaitingHitl, false);
    assert.equal(updated.tests[0]?.status, 'resulted');
    assert.equal(updated.history[past.seq]!.findings.length, 1);
    assert.equal(updated.history[past.seq]!.tests[0]?.status, 'proposed');
    assert.deepEqual(await (await fetch(`${url}/api/cases/${parent.id}`)).json(), before);
    assert.deepEqual(await (await fetch(`${url}/api/cases/${sibling.id}`)).json(), sibling);
    const nested = await (await post(`${url}/api/cases/${fork.id}/forks`, { frameSeq: updated.history.at(-1)!.seq })).json() as Case;
    assert.equal(nested.forkOrigin?.parentCaseId, fork.id);
    assert.equal(nested.findings.at(-1)?.hypothetical, true);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 200);
    assert.equal(inferenceCalls, 1);
    assert.deepEqual(await (await fetch(`${url}/api/cases/${parent.id}`)).json(), before);
    for (const id of [fork.id, sibling.id, nested.id]) assert.equal((await fetch(`${url}/api/cases/${id}`, { method: 'DELETE' })).status, 204);
  });
});

test('forking a completed step reopens only the exploration for diagnostic reconsideration', async () => {
  const parent = caseOf(); proposed(parent);
  const hypothesis = Object.values(parent.hypotheses)[0]!;
  setWorkingDiagnosis(parent, hypothesis.id, undefined, 'Fixture confirmation');
  parent.treatmentPlan = { summary: 'Original plan', steps: [], createdAt: '2026-10-17T00:00:00Z' };
  parent.status = 'closed';
  const completed = capture(parent, 'treatment', 'Original treatment');
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft) }, async (url) => {
    const before = await (await fetch(`${url}/api/cases/${parent.id}`)).json();
    const fork = await (await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq: completed.seq })).json() as Case;
    assert.equal(fork.status, 'reasoning');
    assert.equal(fork.workingDiagnosis, undefined);
    assert.equal(fork.pendingDiagnosis, undefined);
    assert.equal(fork.treatmentPlan, undefined);
    assert.equal(fork.hypotheses[hypothesis.id]?.status, 'live');
    assert.equal(fork.history[completed.seq]?.workingDiagnosis?.name, 'Candidate A');
    assert.equal(fork.history.at(-1)?.workingDiagnosis, undefined);
    assert.equal((await post(`${url}/api/cases/${fork.id}/treat`)).status, 400);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 200);
    assert.deepEqual(await (await fetch(`${url}/api/cases/${parent.id}`)).json(), before);
  });
});

test('invalid fork requests leave the case store and parent unchanged', async () => {
  const parent = caseOf();
  await serve(mockServices, async (url) => {
    const before = await (await fetch(`${url}/api/cases/${parent.id}`)).json();
    const count = (await (await fetch(`${url}/api/cases`)).json() as Case[]).length;
    for (const frameSeq of [-1, 0.5, '0', null, 999, undefined]) {
      assert.equal((await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq })).status, 400);
    }
    assert.equal((await post(`${url}/api/cases/missing/forks`, { frameSeq: 0 })).status, 404);
    assert.equal((await (await fetch(`${url}/api/cases`)).json() as Case[]).length, count);
    assert.deepEqual(await (await fetch(`${url}/api/cases/${parent.id}`)).json(), before);
  });
});

for (const testStatus of ['proposed', 'ordered'] as const) {
test(`reopening a diagnosis restores its unresolved ${testStatus} test gate before another reasoning round`, async () => {
  const parent = caseOf(); proposed(parent);
  parent.tests.push({ id: 'unanswered', name: 'Unanswered test', rationale: 'Fixture', status: testStatus, discriminatesBetween: [] });
  parent.awaitingHitl = true;
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft) }, async (url) => {
    const hypothesisId = Object.values(parent.hypotheses)[0]!.id;
    assert.equal((await post(`${url}/api/cases/${parent.id}/diagnose`, { hypothesisId })).status, 200);
    const confirmed = await (await fetch(`${url}/api/cases/${parent.id}`)).json() as Case;
    assert.equal(confirmed.awaitingHitl, false);
    const fork = await (await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq: confirmed.history.at(-1)!.seq })).json() as Case;
    assert.equal(fork.workingDiagnosis, undefined);
    assert.equal(fork.awaitingHitl, true);
    assert.match(fork.hitlPrompt!, /Unanswered test/);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 409);
    const result = await post(`${url}/api/cases/${fork.id}/finding`, { summary: 'Synthetic assumed result', testId: 'unanswered' });
    assert.equal(result.status, 200);
    const updated = await result.json() as Case;
    assert.equal(updated.awaitingHitl, false);
    assert.equal(updated.findings.at(-1)?.hypothetical, true);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 200);
    assert.deepEqual(await (await fetch(`${url}/api/cases/${parent.id}`)).json(), confirmed);
  });
});
}

test('hypothetical findings never authorize a documented patient coding assignment', async () => {
  const parent = caseOf();
  let codingInputs: string[] = [];
  await serve({ ...mockServices, runRound: async (draft) => proposed(draft), assignMedicalCodes: async (request) => {
    codingInputs = request.evidence.map((f) => f.text);
    return emptyCodes(request);
  } }, async (url) => {
    const fork = await (await post(`${url}/api/cases/${parent.id}/forks`, { frameSeq: 0 })).json() as Case;
    assert.equal((await post(`${url}/api/cases/${fork.id}/finding`, { summary: 'Assumed diagnosis solely for this exploration' })).status, 200);
    assert.equal((await post(`${url}/api/cases/${fork.id}/advance`)).status, 200);
    assert.ok(!codingInputs.some((value) => value.includes('Assumed diagnosis solely')));
  });
});

test('a failed evidence pass and unavailable coding are recorded for the round, not silently dropped', async () => {
  const c = caseOf();
  const failedCodes = async (request: { requestId: string; hypotheses?: { id: string; name: string }[] }) => ({
    requestId: request.requestId, system: 'ICD-10-GM' as const, edition: '2026' as const, searchProvidersUsed: [], limitations: [],
    results: (request.hypotheses ?? []).map((h) => ({ condition: h.name, hypothesisId: h.id, status: 'unavailable' as const, code: null, officialLabel: null, rationale: 'offline', inputRefs: [], references: [], clarificationQuestions: [] })),
  });
  await serve({ ...mockServices, assignMedicalCodes: failedCodes, runRound: async (draft) => proposed(draft), annotateRarity: () => {} }, async (url) => {
    assert.equal((await post(`${url}/api/cases/${c.id}/advance`)).status, 200);
    const payloads = c.events.filter((e) => e.round === c.round).map((e) => e.payload as Record<string, any> | undefined);
    const retrieval = payloads.find((p) => p?.retrieval)?.retrieval;
    assert.deepEqual(retrieval, { status: 'unavailable', sourceCount: 0, acceptedFindings: 0, limitations: ['Mock retrieval unavailable'] });
    assert.deepEqual(payloads.find((p) => p?.coding)?.coding, { status: 'unavailable', attached: 0 });
    assert.ok(Object.values(c.hypotheses).every((h) => !h.codes?.length));
  });
});
