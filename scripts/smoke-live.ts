/** Opt-in, paid smoke test. Synthetic data only; never prints provider error bodies or keys. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { getRuntimeConfig, type Role } from '../server/anthropic/runtime.js';
import { allowedIcdUrl, allowedMedicalUrl } from '../server/experts/retrieval.js';

if (!process.argv.includes('--live') && process.env.LIVE_SMOKE !== '1') {
  console.error('Live requests are disabled. Run npx tsx scripts/smoke-live.ts --live to authorize bounded paid probes.');
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });
const base = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8788';
const report: { timestamp: string; checks: { name: string; status: 'pass' | 'fail' | 'partial' | 'not_run'; detail: unknown }[] } = { timestamp: new Date().toISOString(), checks: [] };
const add = (name: string, status: 'pass' | 'fail' | 'partial' | 'not_run', detail: unknown) => {
  const entry = { name, status, detail }; report.checks.push(entry); console.log(JSON.stringify(entry));
};
const safeError = (error: unknown) => {
  const e = error as { status?: unknown; name?: unknown };
  return { category: typeof e.name === 'string' ? e.name : 'Error', ...(typeof e.status === 'number' ? { httpStatus: e.status } : {}) };
};
async function api(route: string, method = 'GET', body?: unknown, timeout = 15_000) {
  return fetch(base + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
}
function inspectTree(c: any) {
  assert.ok(Object.keys(c.hypotheses).length > 0, 'No hypotheses');
  const visiting = new Set<string>(); const visited = new Set<string>();
  function visit(id: string) {
    assert.ok(c.hypotheses[id], 'Unknown hypothesis ID'); assert.ok(!visiting.has(id), 'Cycle');
    if (visited.has(id)) return;
    visiting.add(id); const h = c.hypotheses[id]; assert.equal(h.id, id);
    assert.ok(Number.isFinite(h.probability)); assert.ok(h.probability >= 0 && h.probability <= 1);
    assert.equal(h.probabilityMode, 'unavailable');
    for (const child of h.childIds) { assert.equal(c.hypotheses[child]?.parentId, id); visit(child); }
    visiting.delete(id); visited.add(id);
  }
  for (const id of c.rootHypothesisIds) { assert.equal(c.hypotheses[id]?.parentId, null); visit(id); }
  assert.equal(visited.size, Object.keys(c.hypotheses).length, 'Unreachable hypotheses');
}
let createdId: string | undefined;
try {
  const healthResponse = await api('/api/health'); assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json(); assert.equal(health.configured, true);
  add('api_health', 'pass', { configured: health.configured, provider: health.provider, models: health.models, orchestratorEffort: health.orchestratorEffort, probabilityMode: health.probabilityMode });
  const config = getRuntimeConfig(); assert.ok(config.configured);
  assert.deepEqual(config.models, health.models, 'Local environment differs from running server');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 60_000 });
  const distinct = new Map<string, Role>();
  for (const role of ['orchestrator', 'researcher', 'validator', 'coding', 'treatment', 'chat'] as Role[]) if (!distinct.has(config.models[role])) distinct.set(config.models[role], role);
  let accessFailed = false;
  for (const [model, role] of distinct) {
    try {
      const response = await client.messages.create({ model, max_tokens: 512, system: 'This is a transport smoke test. Return exactly {"ok":true} with no other text.', messages: [{ role: 'user', content: 'Return the requested JSON object.' }], ...(role === 'orchestrator' ? { output_config: { effort: config.orchestratorEffort as 'low' | 'medium' | 'high' | 'max' } } : {}) });
      const output = response.content.filter(p => p.type === 'text').map(p => p.text).join('');
      assert.notEqual(response.stop_reason, 'max_tokens'); assert.equal(JSON.parse(output).ok, true);
      add(`model_access:${role}`, 'pass', { requestedModel: model, responseModel: response.model, usage: response.usage, ...(role === 'orchestrator' ? { effort: config.orchestratorEffort } : {}) });
    } catch (error) { accessFailed = true; add(`model_access:${role}`, 'fail', { requestedModel: model, ...safeError(error) }); }
  }
  if (accessFailed) {
    add('synthetic_round', 'not_run', 'A configured model probe failed; no full workflow request was made.');
  } else {
    const createdResponse = await api('/api/cases', 'POST', { title: 'Synthetic live verification — delete after test', chiefComplaint: 'Sore throat', history: 'Synthetic adult primary-care presentation. Two days of sore throat with cough and runny nose. No prior diagnostic test. No personal identifiers.', observations: ['Temperature 37.5 C', 'No tonsillar exudate documented', 'No breathing difficulty'], demographics: { ageYears: 30, sex: 'unknown', location: 'Germany' } });
    assert.equal(createdResponse.status, 201); const created = await createdResponse.json(); createdId = created.id;
    const advanceResponse = await api(`/api/cases/${createdId}/advance`, 'POST', undefined, 240_000);
    if (advanceResponse.status !== 200) {
      add('synthetic_round', 'fail', { httpStatus: advanceResponse.status, detail: 'Upstream body withheld; inspect server locally if needed.' });
    } else {
      const c = await advanceResponse.json(); inspectTree(c); assert.equal(c.round, 1);
      assert.equal(c.probabilityMode, 'unavailable'); assert.equal(c.workingDiagnosis, undefined);
      assert.equal(c.history.filter((h: any) => h.kind === 'round').length, 1);
      const initialPatientFindings = new Set(created.findings.filter((f: any) => ['clinician','lab','exam'].includes(f.source)).map((f: any) => f.id));
      assert.ok(c.findings.filter((f: any) => ['clinician','lab','exam'].includes(f.source)).every((f: any) => initialPatientFindings.has(f.id)), 'Agent invented patient finding');
      assert.ok(c.tests.every((t: any) => t.status === 'proposed'), 'Agent ordered/resulted test');
      add('synthetic_round', 'pass', { round: c.round, hypothesisCount: Object.keys(c.hypotheses).length, sourceCount: c.sources.length, findingCount: c.findings.length, awaitingHitl: c.awaitingHitl, proposedDiagnosis: Boolean(c.pendingDiagnosis), probabilityMode: c.probabilityMode });
      const indices = new Map(c.sources.map((s: any) => [s.index, s]));
      for (const s of c.sources) {
        assert.ok(allowedMedicalUrl(s.url) || allowedIcdUrl(s.url)); assert.ok(s.excerpt?.trim().length >= 24); assert.ok(Number.isFinite(Date.parse(s.retrievedAt)));
      }
      for (const f of c.findings.filter((f: any) => f.source === 'web' || f.source === 'literature')) {
        for (const id of f.sourceIndices || []) assert.ok(indices.has(id));
        if (['supported','contradicted'].includes(f.validationStatus)) assert.ok(f.sourceIndices?.length > 0);
      }
      add('retrieval_provenance', c.sources.length ? 'pass' : 'partial', { sourceCount: c.sources.length, supportedLiteratureFindings: c.findings.filter((f: any) => ['web','literature'].includes(f.source) && f.validationStatus === 'supported').length, limitation: 'Checks source-bound metadata and citation integrity. Does not independently establish clinical truth or causal support.' });
      const codeEvent = c.events.findLast((e: any) => e.payload?.system === 'ICD-10-GM');
      const verifiedCandidate = codeEvent?.payload.results.some((r: any) => r.references?.length && (r.code || r.candidates?.length));
      add('coding_adapter', verifiedCandidate ? 'pass' : 'partial', codeEvent ? { statuses: codeEvent.payload.results.map((r: any) => r.status), providers: codeEvent.payload.searchProvidersUsed, attachedCodes: Object.values(c.hypotheses).flatMap((h: any) => h.codes || []).map((r: any) => ({ code: r.code, system: r.system })), positiveLiveAssignmentVerified: codeEvent.payload.results.some((r: any) => r.status === 'assigned') } : 'No structured coding response was recorded.');
      if (c.awaitingHitl) {
        const blocked = await api(`/api/cases/${createdId}/advance`, 'POST'); assert.equal(blocked.status, 409);
        const after = await (await api(`/api/cases/${createdId}`)).json(); assert.equal(after.round, 1); assert.equal(after.workingDiagnosis, undefined);
        add('clinician_gate', 'pass', { blockedAdvanceStatus: blocked.status, unchangedRound: after.round, diagnosisConfirmed: false });
      } else add('clinician_gate', 'not_run', 'This round requested more information without proposing a test/diagnosis. Covered by offline API tests.');
      const beforeChat = await (await api(`/api/cases/${createdId}`)).json();
      const chatResponse = await api(`/api/cases/${createdId}/chat`, 'POST', { message: 'In one sentence, explain why this application does not currently display calibrated numerical diagnostic probabilities.' }, 120_000);
      if (chatResponse.status === 200) {
        const chat = await chatResponse.json(); assert.ok(typeof chat.reply === 'string' && chat.reply.trim());
        const afterChat = await (await api(`/api/cases/${createdId}`)).json(); assert.deepEqual(afterChat, beforeChat);
        add('chat_read_only', 'pass', 'Live chat returned text without changing case state.');
      } else add('chat_read_only', 'fail', { httpStatus: chatResponse.status });
    }
  }
} catch (error) { add('smoke_run', 'fail', safeError(error)); }
finally {
  if (createdId) {
    try { const deleted = await api(`/api/cases/${createdId}`, 'DELETE'); add('synthetic_case_cleanup', deleted.status === 204 ? 'pass' : 'fail', { httpStatus: deleted.status }); }
    catch (error) { add('synthetic_case_cleanup', 'fail', safeError(error)); }
  }
  add('treatment', 'not_run', 'Outside bounded live smoke budget; requires clinician diagnosis confirmation.');
  fs.writeFileSync(path.join(root, 'docs', 'live-verification-results.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.checks.some(c => c.status === 'fail')) process.exitCode = 1;
}
