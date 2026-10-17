import test from 'node:test';
import assert from 'node:assert/strict';
import { codingConfig, createCodingAdapter } from './coding.js';

const reference = { url: 'https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/block-j40-j47.htm#J46', supportingPassage: 'J46 Status asthmaticus', retrievedAt: '2026-10-17T12:00:00.000Z', retrievalProvider: 'direct' as const };

test('coding adapter passes the request through and maps candidates to reference lists', async () => {
  let seen: unknown;
  const assign = createCodingAdapter(async (request, options) => {
    seen = { request, model: options?.deps?.config?.model };
    return {
      requestId: request.requestId, system: 'ICD-10-GM', edition: '2026', searchProvidersUsed: ['tavily'], limitations: [],
      results: [
        { condition: 'Status asthmaticus', hypothesisId: 'h1', assertion: 'documented', status: 'assigned', code: 'J46', officialLabel: 'Status asthmaticus', rationale: 'ex1', inputRefs: ['ex1'], references: [reference], clarificationQuestions: [] },
        { condition: 'Asthma', assertion: 'documented', status: 'needs_clarification', code: null, officialLabel: null, rationale: '', inputRefs: ['ex1'], references: [], clarificationQuestions: ['Which type?'], candidates: [{ code: 'J45.-', officialLabel: 'Asthma bronchiale', entryKind: 'category', reference }] },
      ],
    };
  });
  const request = { requestId: 'r1', excerpts: [{ id: 'ex1', text: 'Status asthmaticus' }], evidence: [], hypotheses: [{ id: 'h1', name: 'Status asthmaticus' }] };
  const out = await assign(request);
  assert.deepEqual((seen as { request: unknown }).request, request);
  assert.equal(out.results[0]!.code, 'J46');
  assert.equal(out.results[0]!.references[0]!.url, reference.url);
  assert.deepEqual(out.results[1]!.candidates, [{ code: 'J45.-', officialLabel: 'Asthma bronchiale', entryKind: 'category', references: [reference] }]);
});

test('coding uses the app coding model setting', () => {
  assert.equal(codingConfig({ CLAUDE_CODING_MODEL: 'claude-sonnet-5-5', CLAUDE_MODEL: 'other' }).model, 'claude-sonnet-5-5');
  assert.equal(codingConfig({ CLAUDE_MODEL: 'other' }).model, 'other');
});
