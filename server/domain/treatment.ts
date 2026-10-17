import { askJson } from '../anthropic/runtime.js';
import { TREATMENT_PROMPT } from './agent-definitions.js';
import { groundLinks } from './parse.js';
import { appendEvent } from './case-store.js';
import { mergeSources, renderSourcePool, rewriteMarkers } from './sources.js';
import type { Case, TreatmentPlan } from './types.js';
interface RawPlan { summary?: string; steps?: { title: string; detail?: string; sourceRef?: string }[]; caseFinding?: { summary?: string; sites?: { label: string; sourceRef?: string; note?: string }[] } }
export async function buildTreatmentPlan(c: Case, opts: { signal?: AbortSignal } = {}): Promise<TreatmentPlan> {
  if (!c.workingDiagnosis) throw new Error('Confirm the working diagnosis first.');
  const prompt = `CASE MODE: ${c.forkOrigin ? 'HYPOTHETICAL WHAT-IF EXPLORATION. Discuss conditional possibilities only; hypothetical findings are not actual patient results.' : 'clinical record'}
CLINICIAN-CONFIRMED WORKING DIAGNOSIS: ${c.workingDiagnosis.name}
PRESENTATION: ${JSON.stringify(c.presentation)}
FINDINGS: ${JSON.stringify(c.findings)}
SOURCE POOL: ${renderSourcePool(c.sources)}
Return a conservative source-grounded plan. If sources do not support a management claim, say evidence is missing and propose clinician review. No prescription or autonomous treatment.
Schema: {summary:string,steps:[{title:string,detail?:string,sourceRef?:"S1"}],caseFinding?:{summary:string,sites:[{label:string,sourceRef:"S1",note?:string}]}}. Never return URLs; source links are resolved by the server.`;
  const raw = await askJson<RawPlan>('treatment', TREATMENT_PROMPT, prompt, { signal: opts.signal });
  if (typeof raw.summary !== 'string' || !Array.isArray(raw.steps)) throw new Error('Invalid treatment-plan response.');
  const { refMap } = mergeSources(c.sources, undefined, c.round);
  const prose = (s: string | undefined) => groundLinks(rewriteMarkers(s, refMap, 'treatment'), c.sources);
  const source = (ref?: string) => c.sources.find((s) => s.index === refMap[ref || '']);
  const plan: TreatmentPlan = {
    summary: prose(raw.summary) || 'Management evidence unavailable; clinician review required.',
    steps: raw.steps.filter((s) => s && typeof s.title === 'string').map((s) => {
      const src = source(s.sourceRef);
      return { title: prose(s.title) || s.title, detail: prose(s.detail), citation: src ? { label: src.title, url: src.url } : undefined };
    }),
    caseFinding: raw.caseFinding ? {
      summary: prose(raw.caseFinding.summary) || '',
      sites: (raw.caseFinding.sites || []).flatMap((site) => {
        const src = source(site.sourceRef);
        return src?.url ? [{ label: site.label, url: src.url, note: prose(site.note) }] : [];
      }),
    } : undefined,
    createdAt: new Date().toISOString(),
  };
  c.treatmentPlan = plan;
  c.status = 'closed';
  appendEvent(c, { round: c.round, kind: 'treatment', summary: 'Treatment suggestions produced for clinician review', payload: plan });
  return plan;
}

