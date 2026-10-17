/** Explicitly opt-in: at most two synthetic advances and one treatment request. No retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--live') && process.env.LIVE_SMOKE !== '1') {
  console.error('Live follow-up is disabled. Pass --live to authorize bounded paid synthetic requests.');
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8788';
const entries: { name: string; status: 'pass'|'fail'|'partial'|'not_run'; detail: unknown }[] = [];
const started = new Date().toISOString();
const add = (name: string, status: 'pass'|'fail'|'partial'|'not_run', detail: unknown) => {
  const item = { name, status, detail }; entries.push(item); console.log(JSON.stringify(item));
};
const errorInfo = (error: unknown) => ({ name: (error as Error)?.name || 'Error', ...((error as {status?:number})?.status ? {status:(error as {status?:number}).status} : {}) });
async function api(route: string, method = 'GET', body?: unknown, timeout = 15_000) {
  return fetch(base + route, { method, headers:{'content-type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(timeout) });
}
function inspect(c: any) {
  assert.equal(c.probabilityMode,'unavailable'); assert.equal(c.workingDiagnosis,undefined);
  for (const h of Object.values(c.hypotheses) as any[]) {
    assert.equal(h.probabilityMode,'unavailable');
    if (h.parentId) assert.ok(c.hypotheses[h.parentId]?.childIds.includes(h.id));
    for (const id of h.childIds) assert.equal(c.hypotheses[id]?.parentId,h.id);
    for (const e of [...h.evidenceFor,...h.evidenceAgainst]) assert.ok(c.findings.some((f:any)=>f.id===e.findingId));
  }
  for (const f of c.findings) for (const index of f.sourceIndices || []) assert.ok(c.sources.some((s:any)=>s.index===index));
}
let id: string|undefined;
let treatmentSummary: unknown;
try {
  const healthResponse = await api('/api/health'); assert.equal(healthResponse.status,200);
  const health = await healthResponse.json(); assert.equal(health.configured,true);
  add('health','pass',{provider:health.provider,models:health.models,probabilityMode:health.probabilityMode});
  const createResponse = await api('/api/cases','POST',{
    title:'Synthetic follow-up verification — temporary',chiefComplaint:'Sore throat',
    history:'Synthetic clinical fixture only. Adult with two days of sore throat, cough and runny nose. No prior testing and no personal identifiers.',
    observations:['Temperature 37.5 C','No tonsillar exudate documented','No breathing difficulty'],demographics:{ageYears:30,sex:'unknown',location:'Germany'},
  });
  assert.equal(createResponse.status,201); const initial = await createResponse.json(); id = initial.id;
  const firstResponse = await api(`/api/cases/${id}/advance`,'POST',undefined,240_000);
  if (firstResponse.status !== 200) { add('first_round','fail',{httpStatus:firstResponse.status}); throw new Error('First round could not complete'); }
  const first = await firstResponse.json(); inspect(first); assert.equal(first.round,1);
  add('first_round','pass',{hypotheses:Object.keys(first.hypotheses).length,sources:first.sources.length,findings:first.findings.length,awaitingHitl:first.awaitingHitl,pendingDiagnosis:Boolean(first.pendingDiagnosis)});
  const proposedTest = first.tests.find((t:any)=>t.status==='proposed'||t.status==='ordered');
  const finding = proposedTest ? {
    summary:'Synthetic clinician-entered test report: result inconclusive; no positive or negative diagnostic inference is justified.',
    detail:`Synthetic fixture for requested test ${proposedTest.name}. No real test was ordered, performed or interpreted.`,
    source:'lab',direction:'neutral',testId:proposedTest.id,
  } : {
    summary:'Synthetic clinician follow-up: sore throat improving, with persistent mild cough and no new breathing difficulty.',
    detail:'Synthetic fixture only; clinician requests reconsideration after this additional observation.',source:'clinician',direction:'neutral',
  };
  const findingResponse = await api(`/api/cases/${id}/finding`,'POST',finding); assert.equal(findingResponse.status,200);
  const withFinding = await findingResponse.json(); assert.equal(withFinding.awaitingHitl,false); assert.equal(withFinding.pendingDiagnosis,undefined);
  assert.ok(withFinding.findings.some((f:any)=>f.summary===finding.summary));
  if (proposedTest) assert.equal(withFinding.tests.find((t:any)=>t.id===proposedTest.id)?.status,'resulted');
  add('explicit_synthetic_clinician_finding','pass',{gateCleared:!withFinding.awaitingHitl,recordedTestResult:Boolean(proposedTest)});
  const secondResponse = await api(`/api/cases/${id}/advance`,'POST',undefined,240_000);
  if (secondResponse.status !== 200) { add('second_round','fail',{httpStatus:secondResponse.status}); throw new Error('Second round could not complete'); }
  const second = await secondResponse.json(); inspect(second); assert.equal(second.round,2);
  assert.ok(Object.keys(first.hypotheses).every(h=>Boolean(second.hypotheses[h])),'Hypotheses disappeared');
  assert.ok(first.sources.every((s:any)=>second.sources.some((next:any)=>next.index===s.index && next.url===s.url)),'Source indices changed');
  assert.equal(second.history.filter((h:any)=>h.kind==='round').length,2);
  add('second_round','pass',{hypotheses:Object.keys(second.hypotheses).length,sources:second.sources.length,findings:second.findings.length,historyFrames:second.history.length,retainedInitialHypotheses:true,sourceIndicesStable:true,pendingDiagnosis:Boolean(second.pendingDiagnosis)});
  const selected = second.pendingDiagnosis?.hypothesisId || (Object.values(second.hypotheses) as any[]).filter(h=>h.status==='live').sort((a,b)=>b.probability-a.probability)[0]?.id;
  assert.ok(selected,'No live hypothesis available for synthetic clinician selection');
  const diagnosisResponse = await api(`/api/cases/${id}/diagnose`,'POST',{hypothesisId:selected}); assert.equal(diagnosisResponse.status,200);
  const diagnosed = await diagnosisResponse.json(); assert.equal(diagnosed.workingDiagnosis?.hypothesisId,selected); assert.equal(diagnosed.workingDiagnosis.confidence,undefined); assert.equal(diagnosed.awaitingHitl,false);
  add('explicit_synthetic_diagnosis_confirmation','pass',{status:diagnosed.status,confirmed:true,confidenceAbsent:true,selectionPurpose:'API workflow test only; not a clinical conclusion.'});
  const treatmentResponse = await api(`/api/cases/${id}/treat`,'POST',undefined,240_000);
  if (treatmentResponse.status !== 200) { add('treatment','fail',{httpStatus:treatmentResponse.status}); throw new Error('Treatment could not complete'); }
  const treated = await treatmentResponse.json(); assert.ok(treated.treatmentPlan); assert.equal(typeof treated.treatmentPlan.summary,'string'); assert.ok(Array.isArray(treated.treatmentPlan.steps));
  const beforeSources = new Set(diagnosed.sources.map((s:any)=>s.url));
  for (const step of treated.treatmentPlan.steps) if(step.citation?.url) assert.ok(beforeSources.has(step.citation.url),'Novel citation URL');
  for (const site of treated.treatmentPlan.caseFinding?.sites||[]) if(site.url) assert.ok(beforeSources.has(site.url),'Novel site URL');
  const steps = treated.treatmentPlan.steps;
  treatmentSummary = {summary:treated.treatmentPlan.summary,steps,caseFinding:treated.treatmentPlan.caseFinding,sourceExcerpts:diagnosed.sources.map((s:any)=>({index:s.index,url:s.url,excerptPreview:typeof s.excerpt==='string'?s.excerpt.split(/\s+/u).slice(0,20).join(' '):undefined}))};
  add('treatment','pass',{status:treated.status,stepCount:steps.length,citedSteps:steps.filter((s:any)=>s.citation?.url).length,uncitedSteps:steps.filter((s:any)=>!s.citation?.url).length,historyFrames:treated.history.length,novelSourceUrls:false});
  add('treatment_claim_validation','partial','Only source URL membership is mechanically enforced by current runtime. Claim support, dosage, applicability, and cited passage entailment require review; source URLs alone do not establish those properties.');
} catch(error) { add('followup_run','fail',errorInfo(error)); }
finally {
  if(id) {
    try { const response=await api(`/api/cases/${id}`,'DELETE'); add('synthetic_case_cleanup',response.status===204?'pass':'fail',{httpStatus:response.status}); }
    catch(error) { add('synthetic_case_cleanup','fail',errorInfo(error)); }
  }
  const lines = ['# Follow-up live workflow verification','',`Run started: ${started}. API: ${base}. Only synthetic clinical material and explicit synthetic clinician actions were used. No model-access probes were repeated. At most two advances and one treatment request were issued, without application-level retries.`,'','## Observed checks','',...entries.map(e=>`- **${e.status.toUpperCase()} — ${e.name}:** ${typeof e.detail==='string'?e.detail:JSON.stringify(e.detail)}`),'','## Sanitized treatment and source excerpts','',treatmentSummary?'```json\n'+JSON.stringify(treatmentSummary,null,2)+'\n```':'Treatment was not reached.','','## Source-grounding limitations','','The treatment runtime provides the existing source pool and asks for supported suggestions, but resolves citations solely by source-reference membership. It performs no independent claim-to-passage check, and it accepts uncited steps. It does not fetch management-specific evidence at treatment time. Case-finding sites can therefore inherit a valid source URL without demonstrating the source actually describes that clinical site or outcome.','','The temporary coding adapter checks an official code and label together in retrieved catalogue text and requires a cited passage, which establishes reference provenance. Interpretation of patient documentation, mention status, terminal-code completeness, and coding-rule applicability still relies partly on the model. The HTTP integration does not independently re-run these semantic checks on an externally replaced coding module; teammate integration needs a contract and tests for them.','','This verifies execution, state transitions, and citation membership. It does not establish diagnostic accuracy, correct clinical management, or calibrated probabilities. A synthetic clinician selecting a live hypothesis is an API exercise, not a clinical conclusion.',''];
  fs.writeFileSync(path.join(root,'docs','LIVE_FOLLOWUP_VERIFICATION.md'),lines.join('\n'));
  if(entries.some(e=>e.status==='fail')) process.exitCode=1;
}
