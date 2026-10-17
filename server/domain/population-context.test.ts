import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCase } from './case-factory.js';
import { runRound } from './engine.js';
import { createRarityLookup } from './rarity.js';
import type { askJson } from '../anthropic/runtime.js';

const lookup = createRarityLookup([{ orphaCode: '999', names: { en: 'Fixture disease', de: 'Testkrankheit' },
  url: 'https://www.orpha.net/en/disease/detail/999', group: 'Disorder', type: 'Disease', records: [
    { id: 'r1', type: 'Point prevalence', qualification: 'Value and class', prevalenceClass: '1-5 / 10 000',
      rawValue: 11, geography: 'Europe', validationStatus: 'Validated', source: '123456[PMID]' },
  ] }], { release: 'fixture-release', dataHash: 'fixture-hash' });
const makeCase = () => createCase({ chiefComplaint: 'Synthetic test', demographics: { location: 'Germany' } });
const response = { hypotheses: [{ name: 'Fixture disease', rank: 1, isZebra: true }], message: 'Ranked', decision: { kind: 'gather', reason: 'Review' } };
function inference(callback: (prompt: string) => unknown): typeof askJson {
  return async <T>(_role: Parameters<typeof askJson>[0], _system: string, prompt: string) => callback(prompt) as T;
}

test('first-round new candidate receives source-backed population review; later round receives it initially', async () => {
  const c = makeCase();
  const prompts: string[] = [];
  await runRound(c, { lookupPopulation: lookup, infer: inference((prompt) => { prompts.push(prompt); return response; }) });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1]!, /0.011%/);
  assert.match(prompts[1]!, /Europe fallback reference; not matched to patient location/);
  assert.match(prompts[1]!, /sourceRefs.*S1/);
  assert.ok(c.sources.some((source) => source.url === 'https://pubmed.ncbi.nlm.nih.gov/123456/'));
  const h = Object.values(c.hypotheses)[0]!;
  assert.deepEqual(h.populationContextUsed, { round: 1, pass: 2, recordIds: ['r1'] });
  assert.equal(h.probabilityMode, 'unavailable');
  assert.equal(c.workingDiagnosis, undefined);
  assert.equal(c.tests.length, 0);
  const audit = c.events.find((event) => (event.payload as { type?: string })?.type === 'population_context')!;
  assert.match(JSON.stringify(audit.payload), /fixture-hash/);
  prompts.length = 0;
  await runRound(c, { lookupPopulation: lookup, infer: inference((prompt) => { prompts.push(prompt); return response; }) });
  assert.equal(prompts.length, 1);
  assert.match(prompts[0]!, /0.011%/);
  assert.equal(h.populationContextUsed?.round, 2);
});

test('missing catalogue data does not trigger review or infer patient percentages', async () => {
  const c = makeCase(); let calls = 0;
  await runRound(c, { lookupPopulation: lookup, infer: inference(() => { calls++; return { ...response, hypotheses: [{ name: 'No exact match', rank: 1 }] }; }) });
  assert.equal(calls, 1);
  assert.equal(c.sources.length, 0);
  assert.equal(Object.values(c.hypotheses)[0]?.populationContextUsed, undefined);
  assert.equal(c.probabilityMode, 'unavailable');
});

test('cancellation during population review leaves case and sources unchanged', async () => {
  const c = makeCase(); const before = structuredClone(c); const controller = new AbortController(); let calls = 0;
  await assert.rejects(runRound(c, { lookupPopulation: lookup, signal: controller.signal, infer: inference(() => {
    calls++; if (calls === 2) controller.abort(); return response;
  }) }), /abort/i);
  assert.equal(calls, 2);
  assert.deepEqual(c, before);
});


test('new candidate in a later round gets one bounded review and existing missing-data branch survives', async () => {
  const c = makeCase();
  await runRound(c, { lookupPopulation: lookup, infer: inference(() => ({ ...response, hypotheses: [{ name: 'Unmatched initial option', rank: 1 }] })) });
  let calls = 0;
  await runRound(c, { lookupPopulation: lookup, infer: inference((prompt) => {
    calls++;
    if (calls === 2) assert.match(prompt, /POPULATION REFERENCES FOR REVIEW[\s\S]*r1/);
    return { ...response, hypotheses: [{ name: 'Fixture disease', rank: 2, baseRateNote: 'Population estimate [S1]' }] };
  }) });
  assert.equal(calls, 2);
  assert.equal(c.round, 2);
  assert.equal(Object.values(c.hypotheses).find((h) => h.name === 'Unmatched initial option')?.status, 'live');
  assert.match(Object.values(c.hypotheses).find((h) => h.name === 'Fixture disease')!.baseRateNote!, /\[1\]/);
});
