/** Express API. Claude executes bounded application-owned steps; clinicians own tests and verdicts. */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { askText, getRuntimeConfig, requireAnthropicKey } from './anthropic/runtime.js';
import { store, appendEvent } from './domain/case-store.js';
import { capture } from './domain/history.js';
import { createCase } from './domain/case-factory.js';
import { forkCase } from './domain/fork.js';
import { recordFinding, resultTest, runRound, setWorkingDiagnosis } from './domain/engine.js';
import { applyEvidence, attachEvidenceTargets, fetchEvidence } from './domain/evidence.js';
import { groundLinks } from './domain/parse.js';
import { buildTreatmentPlan } from './domain/treatment.js';
import { mergeSources, renderSourcePool, rewriteMarkers } from './domain/sources.js';
import { assignMedicalCodes } from './experts/index.js';
import type { Case, Presentation } from './domain/types.js';

export function loadRootEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) { dotenv.config({ path: candidate }); return; }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
loadRootEnv();
const defaults = { runRound, fetchEvidence, assignMedicalCodes, buildTreatmentPlan, askText, requireInference: requireAnthropicKey };
export function createApp(overrides: Partial<typeof defaults> = {}) {
  const services = { ...defaults, ...overrides };
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  const busy = new Set<string>();
  const subscribers = new Map<string, Set<(event: unknown) => void>>();
  const emit = (id: string, kind: string, payload: unknown) => subscribers.get(id)?.forEach((send) => send({ kind, payload }));
  const failure = (res: express.Response, error: unknown) => {
    const e = error as Error & { status?: number; code?: string };
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : e.name === 'AbortError' || e.name === 'TimeoutError' ? 504 : 502;
    res.status(status).json({ error: e.message || 'Workflow could not complete.', code: e.code || 'WORKFLOW_FAILED' });
  };
  const lookup = (id: string, res: express.Response) => {
    const c = store.get(id);
    if (!c) res.status(404).json({ error: 'case not found' });
    return c;
  };
  const unlocked = (id: string, res: express.Response): boolean => {
    if (!busy.has(id)) return true;
    res.status(409).json({ error: 'A workflow is already running for this case.', code: 'CASE_BUSY' });
    return false;
  };
  function requestSignal(req: express.Request, res: express.Response) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const onClose = () => { if (!res.writableEnded) abort(); };
    req.on('aborted', abort);
    res.on('close', onClose);
    return { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]), dispose: () => { req.off('aborted', abort); res.off('close', onClose); } };
  }
  function commit(draft: Case) {
    if (!store.get(draft.id)) throw new Error('Case was deleted during the workflow.');
    store.update(draft.id, (c) => Object.assign(c, draft));
  }
  app.get('/api/health', (_req, res) => {
    const config = getRuntimeConfig();
    res.json({ ok: true, arbor: true, ...config, hasClient: config.configured, hasTeam: true,
      experts: { temporary: true, evidence: 'Tavily + Claude validation', coding: 'restricted ICD-10-GM 2026' },
      probabilityMode: 'unavailable', notices: [
        ...(config.configured ? [] : ['Add ANTHROPIC_API_KEY to .env for live cases. The guided tour works without it.']),
        'Evidence and coding adapters are temporary pending teammate replacements.',
        'Clinical probabilities are unavailable until a reviewed numerical model is configured.',
      ] });
  });
  app.get('/api/registry', (_req, res) => res.json({ connectors: [
    { name: 'web-research', provider: 'tavily', temporary: true },
    { name: 'evidence-validation', provider: 'anthropic', temporary: true },
    { name: 'medical-coding', provider: 'anthropic', system: 'ICD-10-GM', edition: '2026', temporary: true },
  ] }));
  app.post('/api/cases', (req, res) => {
    const body = req.body as Partial<Presentation> & { title?: string };
    if (!body || typeof body.chiefComplaint !== 'string' || !body.chiefComplaint.trim() ||
      (body.observations !== undefined && (!Array.isArray(body.observations) || body.observations.some((s) => typeof s !== 'string'))) ||
      (body.demographics !== undefined && (!body.demographics || typeof body.demographics !== 'object' || Array.isArray(body.demographics))) ||
      (body.history !== undefined && typeof body.history !== 'string')) {
      res.status(400).json({ error: 'A chiefComplaint string and valid presentation fields are required.' }); return;
    }
    const c = createCase({ chiefComplaint: body.chiefComplaint.trim(), history: body.history, observations: body.observations || [], demographics: body.demographics || {} }, body.title);
    res.status(201).json(store.snapshot(c.id));
  });
  app.get('/api/cases', (_req, res) => res.json(store.list()));
  app.get('/api/cases/:id', (req, res) => { const c = lookup(req.params.id, res); if (c) res.json(store.snapshot(c.id)); });
  app.delete('/api/cases/:id', (req, res) => { if (unlocked(req.params.id, res)) res.status(store.delete(req.params.id) ? 204 : 404).end(); });

  app.post('/api/cases/:id/forks', (req, res) => {
    const parent = lookup(req.params.id, res);
    if (!parent || !unlocked(parent.id, res)) return;
    const frameSeq = req.body?.frameSeq;
    if (!Number.isSafeInteger(frameSeq) || !parent.history.some((frame) => frame.seq === frameSeq)) {
      res.status(400).json({ error: 'Select a valid timeline step.', code: 'INVALID_FORK_FRAME' }); return;
    }
    const fork = forkCase(parent, frameSeq);
    store.create(fork);
    res.status(201).json(store.snapshot(fork.id));
  });

  app.post('/api/cases/:id/advance', async (req, res) => {
    const c = lookup(req.params.id, res);
    if (!c || !unlocked(c.id, res)) return;
    if (c.awaitingHitl) { res.status(409).json({ error: c.hitlPrompt || 'Complete the clinician action before advancing.', code: 'HITL_REQUIRED' }); return; }
    if (c.workingDiagnosis) { res.status(409).json({ error: 'This case already has a clinician-confirmed working diagnosis.' }); return; }
    busy.add(c.id);
    const request = requestSignal(req, res);
    try {
      services.requireInference();
      const draft = structuredClone(c);
      // Ground the CURRENT round, not the following round. Each tool runs once.
      const evidence = await services.fetchEvidence(draft, { signal: request.signal });
      request.signal.throwIfAborted();
      draft.round += 1;
      applyEvidence(draft, evidence);
      draft.round -= 1;
      if (evidence?.limitations.length) appendEvent(draft, { round: draft.round + 1, kind: 'engine_message', summary: `Evidence limitations: ${evidence.limitations.join(' ')}` });
      const result = await services.runRound(draft, { signal: request.signal });
      attachEvidenceTargets(draft, evidence);
      const targets = Object.values(draft.hypotheses).filter((h) => h.status === 'live').sort((a, b) => b.probability - a.probability).slice(0, 3);
      if (targets.length) {
        try {
          const codes = await services.assignMedicalCodes({
            requestId: `${draft.id}-round-${draft.round}`,
            excerpts: [{ id: 'presentation', text: JSON.stringify(draft.presentation) }],
            evidence: draft.findings.filter((f) => !f.hypothetical).map((f) => ({ id: f.id, text: [f.summary, f.detail].filter(Boolean).join(' '), kind: (f.source === 'literature' || f.source === 'web' ? 'literature' : 'patient_finding') as 'literature' | 'patient_finding' })),
            hypotheses: targets.map((h) => ({ id: h.id, name: h.name })),
          }, { signal: request.signal });
          for (const code of codes.results) {
            const h = code.hypothesisId ? draft.hypotheses[code.hypothesisId] : undefined;
            const references = code.references.filter((ref) => {
              try { const u = new URL(ref.url); return u.protocol === 'https:' && u.hostname === 'klassifikationen.bfarm.de' && u.pathname.startsWith('/icd-10-gm/kode-suche/htmlgm2026/') && Boolean(ref.supportingPassage?.trim()); }
              catch { return false; }
            });
            if (!h || code.status !== 'assigned' || !code.code || !code.officialLabel || !references.length) continue;
            h.codes = [{ system: 'ICD-10-GM 2026', code: code.code, display: code.officialLabel, url: references[0]!.url, reasoning: code.rationale }];
            mergeSources(draft.sources, references.map((r, i) => ({ ref: `C${i + 1}`, title: `ICD-10-GM 2026 ${code.code}: ${code.officialLabel}`, url: r.url, type: 'code', excerpt: r.supportingPassage, retrievedAt: r.retrievedAt, validationStatus: 'supported' })), draft.round);
          }
          appendEvent(draft, { round: draft.round, kind: 'engine_message', summary: 'Medical coding suggestions checked against the official catalogue', payload: codes });
        } catch (error) {
          request.signal.throwIfAborted();
          appendEvent(draft, { round: draft.round, kind: 'engine_message', summary: 'Medical coding unavailable for this round; no unverified codes attached.' });
        }
      }
      request.signal.throwIfAborted();
      if (result.decision.kind === 'converged') {
        const hypothesis = draft.hypotheses[result.decision.hypothesisId];
        if (!hypothesis || hypothesis.status !== 'live') throw new Error('Invalid proposed working diagnosis.');
        draft.pendingDiagnosis = { hypothesisId: hypothesis.id, name: hypothesis.name, reason: result.message };
        draft.awaitingHitl = true;
        draft.hitlPrompt = `Review and confirm the proposed working diagnosis: ${hypothesis.name}, or enter additional findings to reconsider.`;
      } else if (result.decision.kind === 'test') {
        draft.awaitingHitl = true;
        draft.hitlPrompt = `Clinician action: order/perform ${result.decision.test.name}, then enter its result. ${result.decision.test.rationale}`;
      } else {
        draft.awaitingHitl = false; draft.hitlPrompt = undefined; draft.pendingDiagnosis = undefined;
      }
      if (draft.status === 'intake') draft.status = 'reasoning';
      capture(draft, 'round', `Round ${draft.round}`);
      commit(draft);
      emit(c.id, 'round', store.snapshot(c.id));
      res.json(store.snapshot(c.id));
    } catch (error) { if (!res.destroyed) failure(res, error); }
    finally { request.dispose(); busy.delete(c.id); }
  });

  app.post('/api/cases/:id/finding', (req, res) => {
    const c = lookup(req.params.id, res);
    if (!c || !unlocked(c.id, res)) return;
    const body = req.body as { summary?: string; detail?: string; direction?: 'supports' | 'against' | 'neutral'; source?: 'clinician' | 'lab' | 'exam'; hypothesisIds?: string[]; testId?: string };
    if (!body || typeof body.summary !== 'string' || !body.summary.trim() || (body.direction !== undefined && !['supports', 'against', 'neutral'].includes(body.direction)) || (body.source !== undefined && !['clinician', 'lab', 'exam'].includes(body.source)) || (body.detail !== undefined && typeof body.detail !== 'string') || (body.hypothesisIds !== undefined && (!Array.isArray(body.hypothesisIds) || body.hypothesisIds.some((id) => typeof id !== 'string' || !c.hypotheses[id])))) {
      res.status(400).json({ error: 'A summary and valid finding fields are required.' }); return;
    }
    const test = body.testId ? c.tests.find((t) => t.id === body.testId) : undefined;
    if (body.testId && !test) { res.status(400).json({ error: 'Unknown testId; no finding was recorded.' }); return; }
    if (test?.status === 'resulted') { res.status(409).json({ error: 'This test already has a result.' }); return; }
    const draft = structuredClone(c);
    const f = recordFinding(draft, { summary: body.summary.trim(), detail: body.detail, direction: body.direction, source: body.source, hypothesisIds: body.hypothesisIds });
    if (body.testId) resultTest(draft, body.testId, f.id);
    // An unrelated observation cannot silently satisfy a pending test request.
    if (draft.pendingDiagnosis || body.testId || !draft.tests.some((t) => t.status === 'proposed' || t.status === 'ordered')) {
      draft.awaitingHitl = false; draft.hitlPrompt = undefined; draft.pendingDiagnosis = undefined;
    }
    capture(draft, 'finding', `Result: ${body.summary.slice(0, 32)}`);
    commit(draft); emit(c.id, 'finding', f); res.json(store.snapshot(c.id));
  });

  app.post('/api/cases/:id/diagnose', (req, res) => {
    const c = lookup(req.params.id, res);
    if (!c || !unlocked(c.id, res)) return;
    const hypothesisId = req.body?.hypothesisId;
    const h = typeof hypothesisId === 'string' ? c.hypotheses[hypothesisId] : undefined;
    if (!h || h.status !== 'live') { res.status(400).json({ error: 'Explicitly select a live hypothesis to confirm as the working diagnosis.' }); return; }
    const draft = structuredClone(c);
    // No LLM confidence or user-supplied arbitrary percentage is promoted to a clinical probability.
    setWorkingDiagnosis(draft, h.id, undefined, 'Working diagnosis confirmed by clinician.');
    capture(draft, 'diagnosis', `Diagnosis: ${h.name.slice(0, 32)}`);
    commit(draft); emit(c.id, 'diagnosis', store.snapshot(c.id)); res.json(store.snapshot(c.id));
  });

  app.post('/api/cases/:id/treat', async (req, res) => {
    const c = lookup(req.params.id, res);
    if (!c || !unlocked(c.id, res)) return;
    if (!c.workingDiagnosis) { res.status(400).json({ error: 'Confirm the working diagnosis first.' }); return; }
    busy.add(c.id); const request = requestSignal(req, res);
    try {
      services.requireInference(); const draft = structuredClone(c);
      const plan = await services.buildTreatmentPlan(draft, { signal: request.signal });
      request.signal.throwIfAborted(); capture(draft, 'treatment', 'Treatment plan'); commit(draft);
      emit(c.id, 'treatment', plan); res.json(store.snapshot(c.id));
    } catch (error) { if (!res.destroyed) failure(res, error); }
    finally { request.dispose(); busy.delete(c.id); }
  });
  app.post('/api/cases/:id/chat', async (req, res) => {
    const c = lookup(req.params.id, res); if (!c) return;
    if (typeof req.body?.message !== 'string' || !req.body.message.trim()) { res.status(400).json({ error: 'message is required' }); return; }
    const request = requestSignal(req, res);
    try {
      services.requireInference();
      const reply = await services.askText('chat', 'You are Arbor clinical decision support. Discuss the supplied case and uncertainty. Never invent patient observations, URLs or probabilities. Findings marked hypothetical belong to a what-if exploration and are not actual patient results. Cite only supplied S<number> refs; never change case state.', `CASE MODE: ${c.forkOrigin ? 'HYPOTHETICAL WHAT-IF EXPLORATION' : 'clinical record'}\nCASE DATA: ${JSON.stringify(c.presentation)}\nDIFFERENTIAL: ${JSON.stringify(Object.values(c.hypotheses).map((h) => ({ name: h.name, status: h.status })))}\nFINDINGS: ${JSON.stringify(c.findings)}\nSOURCES: ${renderSourcePool(c.sources)}\nCLINICIAN QUESTION: ${req.body.message}`, { signal: request.signal });
      res.json({ reply: groundLinks(rewriteMarkers(reply, mergeSources(c.sources, undefined, c.round).refMap, 'chat'), c.sources) });
    } catch (error) { if (!res.destroyed) failure(res, error); }
    finally { request.dispose(); }
  });
  app.get('/api/cases/:id/stream', (req, res) => {
    const c = lookup(req.params.id, res); if (!c) return;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: snapshot\ndata: ${JSON.stringify(store.snapshot(c.id))}\n\n`);
    const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const set = subscribers.get(c.id) || new Set(); set.add(send); subscribers.set(c.id, set);
    const timer = setInterval(() => res.write(': keepalive\n\n'), 15_000);
    req.on('close', () => { clearInterval(timer); set.delete(send); if (!set.size) subscribers.delete(c.id); });
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8788);
  createApp().listen(port, '127.0.0.1', () => console.log(`[arbor] Claude server http://localhost:${port}; live inference ${getRuntimeConfig().configured ? 'configured' : 'awaiting ANTHROPIC_API_KEY'}`));
}
