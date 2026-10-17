// gatherEvidence: the one public entry point. Orchestrates SPEC.md steps 1-5.
import { randomUUID } from "node:crypto";
import { analyse, buildQuestions, findingLabel, type Analysis } from "./analyse.js";
import { check, doubleCheck } from "./check.js";
import { NUMBER_FIELDS, type Question } from "./internal.js";
import { screenRequest } from "./privacy.js";
import { Http, ProviderHealth } from "./retrieve/http.js";
import { retrieveForQuestion, type RetrieveContext } from "./retrieve/index.js";
import { publicSource, SourceStore } from "./sources.js";
import type {
  Config,
  DiagnosisResult,
  ErrorEntry,
  Evidence,
  EvidenceRequest,
  EvidenceResponse,
  LikelihoodRatioItem,
  PatientFinding,
  PriorItem,
} from "./types.js";
import type { Deps } from "./types.js";
import { decideItem, verifyFindings, type DecidedItem } from "./verify.js";

export const DEFAULT_CONFIG: Config = {
  maxDiagnoses: 3,
  maxFindingsPerDiagnosis: 3,
  maxSourcesPerQuestion: 8,
  concurrency: 4,
  httpTimeoutMs: 15_000,
  requestBudgetMs: 180_000,
  maxConsecutiveProviderFailures: 3,
};

const LIMITATIONS = [
  "Prototype; not clinical validation. Values are candidate inputs for a separate probability step, not probabilities.",
  "Diagnoses are search starting points suggested by a model, not confirmed diagnoses.",
  "Only status 'supported' values passed code verification and an independent second check.",
];

interface QuestionOutcome {
  q: Question;
  item: DecidedItem;
}

class BudgetExceeded extends Error {}

function withDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
  const ms = deadline - Date.now();
  if (ms <= 0) return Promise.reject(new BudgetExceeded("time budget exhausted"));
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BudgetExceeded("time budget exhausted")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const emptyItem = (q: Question, note: string): DecidedItem => decideWithNote(decideItem(q, [], []), note);

function decideWithNote(item: DecidedItem, note: string): DecidedItem {
  return { ...item, note: [item.note, note].filter(Boolean).join(" ") };
}

export async function gatherEvidence(request: EvidenceRequest, deps: Deps): Promise<EvidenceResponse> {
  const config: Config = { ...DEFAULT_CONFIG, ...deps.config };
  const now = deps.now ?? (() => new Date());
  const deadline = Date.now() + config.requestBudgetMs;
  const requestId = request.requestId?.trim() || randomUUID();
  const errors: ErrorEntry[] = [];
  const respond = (rest: Partial<EvidenceResponse> & Pick<EvidenceResponse, "status">): EvidenceResponse => ({
    requestId,
    generatedAt: now().toISOString(),
    diagnoses: [],
    evidence: [],
    patientFindings: [],
    sources: [],
    errors,
    limitations: LIMITATIONS,
    ...rest,
  });

  const screen = screenRequest(request);
  if (!screen.ok) {
    errors.push({ step: "screen", message: `Request rejected before any call: ${screen.field} (${screen.kind}). Send pseudonymised data only.` });
    return respond({ status: "failed" });
  }

  let llmFailures = 0;
  const llm = {
    async complete(...args: Parameters<Deps["llm"]["complete"]>) {
      if (llmFailures >= config.maxConsecutiveProviderFailures) {
        throw new Error(`Claude skipped after ${llmFailures} consecutive failures`);
      }
      try {
        const out = await deps.llm.complete(...args);
        llmFailures = 0;
        return out;
      } catch (e) {
        llmFailures++;
        throw e;
      }
    },
  };

  let analysis: Analysis;
  try {
    analysis = await withDeadline(analyse(llm, screen.minimised, config), deadline);
  } catch (e) {
    errors.push({ step: e instanceof BudgetExceeded ? "budget" : "analyse", message: (e as Error).message });
    return respond({ status: "failed" });
  }
  if (!analysis.diagnoses.length) {
    errors.push({ step: "analyse", message: "No diagnoses to research were identified." });
    return respond({ status: "failed" });
  }
  for (const r of analysis.rejected) errors.push({ step: "analyse", message: `Finding dropped: ${r}` });

  const questions = buildQuestions(analysis, screen.minimised.ageBand);
  const store = new SourceStore();
  const ctx: RetrieveContext = {
    http: new Http(deps.fetch, config.httpTimeoutMs),
    health: new ProviderHealth(config.maxConsecutiveProviderFailures),
    store,
    now,
    config,
    errors,
    fullText: new Map(),
    searches: new Map(),
    guidelines: new Map(),
  };

  async function answer(q: Question): Promise<QuestionOutcome> {
    const retrieved = await retrieveForQuestion(q, analysis.presentingProblem, ctx);
    if (!retrieved.passages.length) {
      return { q, item: decideItem(q, [], retrieved.sources) };
    }
    let proposed;
    try {
      proposed = await check(llm, q, retrieved.passages);
    } catch (e) {
      errors.push({ step: "check", question: q.text, message: (e as Error).message });
      return { q, item: decideWithNote(decideItem(q, [], retrieved.sources), "The literature check failed; nothing was verified.") };
    }
    const { accepted } = verifyFindings(q, proposed, store);
    for (const f of accepted) {
      // Supports without numbers can't become a value; everything else needs a second opinion.
      if (f.stance === "supports" && !NUMBER_FIELDS[q.kind].some((k) => f.numbers[k] != null)) continue;
      try {
        const verdict = await doubleCheck(llm, q, f, store.get(f.sourceId)!);
        f.doubleCheck = verdict.agree ? "agreed" : "disagreed";
        if (!verdict.agree) f.notes.push(`Second check disagreed: ${verdict.reason}`);
      } catch (e) {
        f.doubleCheck = "disagreed";
        f.notes.push("Second check could not run, so this is not counted as support.");
        errors.push({ step: "double-check", question: q.text, message: (e as Error).message });
      }
    }
    return { q, item: decideItem(q, accepted, retrieved.sources) };
  }

  const outcomes = await pool(questions, config.concurrency, async (q) => {
    try {
      return await withDeadline(answer(q), deadline);
    } catch (e) {
      const budget = e instanceof BudgetExceeded;
      errors.push({ step: budget ? "budget" : "retrieve", question: q.text, message: budget ? `Not finished within ${config.requestBudgetMs} ms` : (e as Error).message });
      return { q, item: emptyItem(q, budget ? "Not finished within the time budget." : "Retrieval failed.") };
    }
  });

  // ---- Assemble the calculator-ready response ----
  const evidence: Evidence[] = [];
  const evidenceIdsFor = (item: DecidedItem) =>
    item.used.map((f) => {
      const id = `e${evidence.length + 1}`;
      evidence.push({
        id,
        sourceId: f.sourceId,
        url: store.get(f.sourceId)!.url,
        passage: f.quote,
        doubleCheck: f.doubleCheck,
        reason: f.reason,
        limitations: f.limitations,
        stance: f.stance,
        kind: "literature",
      });
      return id;
    });

  const common = (item: DecidedItem) => ({
    status: item.status,
    ci95: item.ci95,
    population: item.population,
    setting: item.setting,
    denominator: item.denominator,
    missing: item.missing,
    evidenceIds: evidenceIdsFor(item),
    ...(item.note ? { note: item.note } : {}),
  });

  const diagnoses: DiagnosisResult[] = analysis.diagnoses.map((d) => {
    const mine = outcomes.filter((o) => o.q.diagnosis.id === d.id);
    const priorOutcome = mine.find((o) => o.q.kind === "prior")!;
    const prior: PriorItem = {
      question: priorOutcome.q.text,
      value: priorOutcome.item.value ?? null,
      unit: "proportion",
      ...common(priorOutcome.item),
    };
    const likelihoodRatios: LikelihoodRatioItem[] = mine
      .filter((o) => o.q.kind === "lr")
      .map(({ q, item }) => ({
        question: q.text,
        finding: findingLabel(q.finding!),
        quotedFrom: q.finding!.quotedFrom,
        lrPositive: item.lrPositive ?? null,
        lrNegative: item.lrNegative ?? null,
        sensitivity: item.sensitivity ?? null,
        specificity: item.specificity ?? null,
        ...common(item),
      }));
    return { id: d.id, diagnosis: d.name, origin: "suggested_by_model", prior, likelihoodRatios };
  });

  const patientFindings: PatientFinding[] = [
    ...new Map(analysis.diagnoses.flatMap((d) => d.findings).map((f) => [f.id, f])).values(),
  ].map((f) => ({ id: f.id, text: findingLabel(f), quotedFrom: f.quotedFrom, kind: "patient_finding" }));

  const items = diagnoses.flatMap((d) => [d.prior, ...d.likelihoodRatios]);
  const answered = items.every((i) => ["supported", "contradicted", "conflicting"].includes(i.status));
  const status = store.all().length === 0 ? "failed" : answered ? "complete" : "partial";

  return respond({
    status,
    diagnoses,
    evidence,
    patientFindings,
    sources: store.all().map(publicSource),
  });
}
