// Step 3: RETRIEVE. Papers first (Europe PMC, PubMed fallback), guidelines via DuckDuckGo.
// Every query is built here from search terms only, never from patient text.
import type { Question } from "../internal.js";
import { findingLabel } from "../analyse.js";
import { isCaseReport, paperSource, rankSources, SourceStore } from "../sources.js";
import type { Config, ErrorEntry, StoredSource } from "../types.js";
import { fetchGuidelinePage, ProviderBlocked, searchGuidelines } from "./duckduckgo.js";
import type { Http, ProviderHealth } from "./http.js";
import { fetchEuropePmcFullText, searchEuropePmc, searchPubMed, type PaperRecord } from "./papers.js";
import { selectPassages } from "./text.js";
import { CREDITS_PER_SEARCH, searchGuidelinesTavily, type CreditBudget } from "./tavily.js";

export interface RetrieveContext {
  http: Http;
  health: ProviderHealth;
  store: SourceStore;
  now: () => Date;
  config: Config;
  errors: ErrorEntry[];
  fullText: Map<string, Promise<string | null>>;
  /** Europe PMC searches by query and sort; variants shared by several questions run once. */
  searches: Map<string, Promise<PaperRecord[]>>;
  guidelines: Map<string, Promise<StoredSource[]>>;
  /** DuckDuckGo searches run one at a time, so a block is seen before the next search starts. */
  ddgQueue?: Promise<unknown>;
  tavily?: { apiKey: string; budget: CreditBudget; http: Http; searches: number };
}

export interface Retrieved {
  sources: StoredSource[];
  passages: { source: StoredSource; passages: string[] }[];
}

const PASSAGE_CHARS = 3500;

const LR_TERMS = '("likelihood ratio" OR sensitivity OR specificity OR "diagnostic accuracy" OR "clinical prediction")';
const PRIOR_TERMS = "(prevalence OR proportion OR incidence OR aetiology OR etiology)";
const REVIEW_TERMS = '("systematic review" OR "meta-analysis" OR "rational clinical examination" OR "clinical prediction rule" OR "clinical decision rule")';
const SETTING_TERMS = '("primary care" OR "general practice" OR "family practice" OR "emergency department")';
const BASE_RATE_TERMS = '(prevalence OR proportion OR "final diagnosis" OR "final diagnoses" OR aetiology OR etiology OR causes)';
/** Preprints are not peer reviewed; the adapters drop any that slip through. */
const NOT_PREPRINT = " AND NOT SRC:PPR";
/** Highly cited studies are the classic diagnostic-accuracy and base-rate papers. */
const CITED = "CITED desc";

/** Candidates taken from the top of each search's order. */
const RELEVANCE_POOL = 10;

/**
 * Plain concept words, grouped. Live runs showed exact-phrase quoting returns nothing and
 * full-text matching returns off-topic papers, so Europe PMC searches title and abstract only.
 */
export function paperQuery(q: Question, problem: string, field: "" | "TITLE_ABS:" = ""): string {
  const parts = [`(${q.diagnosis.searchTerm})`];
  if (q.kind === "prior") {
    parts.push(PRIOR_TERMS);
    if (problem) parts.push(`(${problem})`);
  } else {
    parts.push(`(${q.finding!.searchTerm})`, LR_TERMS);
  }
  return parts.map((p) => field + p).join(" AND ");
}

export interface PaperSearch {
  query: string;
  sort?: string;
}

/**
 * One question asked several ways, still title/abstract only and without exact-phrase concepts:
 * the main query in relevance and citation order, plus a broader variant. For a base rate the
 * variant looks for studies of the presenting problem by care setting; for a likelihood ratio it
 * looks for reviews and prediction rules of the diagnosis, which report many findings at once.
 */
export function europePmcSearches(q: Question, problem: string): PaperSearch[] {
  const f = "TITLE_ABS:";
  const and = (...parts: string[]) => parts.map((p) => f + p).join(" AND ") + NOT_PREPRINT;
  const dx = `(${q.diagnosis.searchTerm})`;
  const main = paperQuery(q, problem, f) + NOT_PREPRINT;
  if (q.kind === "prior") {
    return [
      { query: main },
      { query: main, sort: CITED },
      { query: and(dx, ...(problem ? [`(${problem})`] : []), SETTING_TERMS, BASE_RATE_TERMS), sort: CITED },
      { query: and(dx, PRIOR_TERMS, REVIEW_TERMS), sort: CITED },
    ];
  }
  return [{ query: main }, { query: main, sort: CITED }, { query: and(dx, LR_TERMS, REVIEW_TERMS), sort: CITED }];
}

/** Round-robin over the result lists, so every variant's best hits are near the front. */
function interleave(lists: PaperRecord[][]): PaperRecord[] {
  const out: PaperRecord[] = [];
  const seen = new Set<string>();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const r = l[i];
      if (!r) continue;
      const keys = [r.pmcid, r.pmid, r.doi?.toLowerCase()].filter(Boolean) as string[];
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      out.push(r);
    }
  }
  return out;
}

function europePmc(s: PaperSearch, q: Question, ctx: RetrieveContext): Promise<PaperRecord[]> {
  const key = `${s.sort ?? ""}|${s.query}`;
  let p = ctx.searches.get(key);
  if (!p) {
    p = (async () => {
      if (ctx.health.disabled("europepmc")) return [];
      try {
        const r = await searchEuropePmc(ctx.http, s.query, RELEVANCE_POOL, s.sort);
        ctx.health.ok("europepmc");
        return r;
      } catch (e) {
        ctx.health.fail("europepmc");
        ctx.errors.push({ step: "retrieve", question: q.text, message: `Europe PMC: ${(e as Error).message}` });
        return [];
      }
    })();
    ctx.searches.set(key, p);
  }
  return p;
}

async function searchPapers(q: Question, problem: string, ctx: RetrieveContext): Promise<PaperRecord[]> {
  const { health, http, errors } = ctx;
  const merged = interleave(await Promise.all(europePmcSearches(q, problem).map((s) => europePmc(s, q, ctx))));
  if (merged.length) return merged;
  if (!health.disabled("pubmed")) {
    try {
      const r = await searchPubMed(http, paperQuery(q, problem), RELEVANCE_POOL);
      health.ok("pubmed");
      return r;
    } catch (e) {
      health.fail("pubmed");
      errors.push({ step: "retrieve", question: q.text, message: `PubMed: ${(e as Error).message}` });
    }
  }
  return [];
}

function fullTextOf(pmcid: string, ctx: RetrieveContext): Promise<string | null> {
  let p = ctx.fullText.get(pmcid);
  if (!p) {
    p = fetchEuropePmcFullText(ctx.http, pmcid).catch((e) => {
      ctx.errors.push({ step: "retrieve", message: `Europe PMC full text ${pmcid}: ${(e as Error).message}` });
      return null;
    });
    ctx.fullText.set(pmcid, p);
  }
  return p;
}

async function papersFor(q: Question, problem: string, ctx: RetrieveContext): Promise<StoredSource[]> {
  const records = await searchPapers(q, problem, ctx);
  const at = () => ctx.now().toISOString();
  // Pick by search order (case reports last), then rank the picks by quality before downloading.
  const picked = [
    ...records.filter((r) => !isCaseReport(r.title, r.pubTypes)),
    ...records.filter((r) => isCaseReport(r.title, r.pubTypes)),
  ].slice(0, ctx.config.maxSourcesPerQuestion);
  const prelim = picked.map((r) => ({
    r,
    s: paperSource(r, r.isOpenAccess && r.pmcid ? "full_text" : r.abstract ? "abstract_only" : "paywalled", "", at()),
  }));
  const ranked = rankSources(prelim.map((p) => p.s)).map((s) => prelim.find((p) => p.s === s)!);
  return Promise.all(
    ranked.map(async ({ r, s: p }) => {
      const full = p.accessLevel === "full_text" ? await fullTextOf(p.pmcid!, ctx) : null;
      const source = full
        ? paperSource(r, "full_text", full, at())
        : r.abstract
          ? paperSource(r, "abstract_only", r.abstract, at())
          : paperSource(r, "paywalled", "", at());
      return ctx.store.add(source);
    }),
  );
}

/**
 * Guideline pages via Tavily, or null to fall back to DuckDuckGo (no key, cap reached,
 * no credits left this month, or Tavily failing). Credits are reserved before each call.
 */
async function tavilyGuidelines(q: Question, problem: string, ctx: RetrieveContext): Promise<StoredSource[] | null> {
  const t = ctx.tavily;
  if (!t || ctx.health.disabled("tavily") || t.searches >= ctx.config.maxTavilySearchesPerRequest) return null;
  if (!(await t.budget.tryConsume(CREDITS_PER_SEARCH))) {
    ctx.health.block("tavily");
    ctx.errors.push({ step: "retrieve", message: "Tavily: monthly credit limit reached; using DuckDuckGo" });
    return null;
  }
  t.searches++;
  try {
    const pages = await searchGuidelinesTavily(t.http, t.apiKey, [q.diagnosis.searchTerm, problem].filter(Boolean).join(" "), 2);
    ctx.health.ok("tavily");
    return pages.map((page) =>
      ctx.store.add({
        id: `url:${page.url}`,
        url: page.url,
        title: page.title,
        studyType: "guideline",
        accessLevel: "full_text",
        retrievedAt: ctx.now().toISOString(),
        provider: "tavily",
        text: page.text,
      }),
    );
  } catch (e) {
    // Auth, quota or rate-limit answers mean stop for this request; never retry around them.
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403 || status === 429 || status === 432 || status === 433) ctx.health.block("tavily");
    else ctx.health.fail("tavily");
    ctx.errors.push({ step: "retrieve", message: `Tavily: ${(e as Error).message}; using DuckDuckGo` });
    return null;
  }
}

function guidelinesFor(q: Question, problem: string, ctx: RetrieveContext): Promise<StoredSource[]> {
  const key = q.diagnosis.id;
  let p = ctx.guidelines.get(key);
  if (!p) {
    const previous = ctx.ddgQueue ?? Promise.resolve();
    p = previous.then(async () => {
      const viaTavily = await tavilyGuidelines(q, problem, ctx);
      if (viaTavily) return viaTavily;
      if (ctx.health.disabled("duckduckgo")) return [];
      let urls: string[];
      try {
        urls = await searchGuidelines(ctx.http, [q.diagnosis.searchTerm, problem].filter(Boolean).join(" "), 1);
        ctx.health.ok("duckduckgo");
      } catch (e) {
        if (e instanceof ProviderBlocked) ctx.health.block("duckduckgo");
        else ctx.health.fail("duckduckgo");
        const why = e instanceof ProviderBlocked ? "blocked or challenged; guidelines skipped" : (e as Error).message;
        ctx.errors.push({ step: "retrieve", message: `DuckDuckGo: ${why}` });
        return [];
      }
      const found: StoredSource[] = [];
      for (const url of urls) {
        const page = await fetchGuidelinePage(ctx.http, url).catch((e) => ({ ok: false as const, url, reason: (e as Error).message }));
        const base = {
          id: `url:${page.url}`,
          url: page.url,
          studyType: "guideline" as const,
          retrievedAt: ctx.now().toISOString(),
          provider: "duckduckgo" as const,
        };
        found.push(
          ctx.store.add(
            page.ok
              ? { ...base, title: page.title, accessLevel: "full_text", text: page.text }
              : { ...base, title: `Guideline page (not retrieved: ${page.reason})`, accessLevel: "inaccessible", text: "" },
          ),
        );
      }
      return found;
    });
    ctx.ddgQueue = p.catch(() => undefined);
    ctx.guidelines.set(key, p);
  }
  return p;
}

export async function retrieveForQuestion(q: Question, problem: string, ctx: RetrieveContext): Promise<Retrieved> {
  const [papers, guides] = await Promise.all([papersFor(q, problem, ctx), guidelinesFor(q, problem, ctx)]);
  const sources = rankSources([...new Map([...guides, ...papers].map((s) => [s.id, s])).values()]).slice(
    0,
    ctx.config.maxSourcesPerQuestion,
  );
  const terms = [q.diagnosis.searchTerm, q.finding ? findingLabel(q.finding) : problem];
  const passages = sources
    .filter((s) => s.text && (s.accessLevel === "full_text" || s.accessLevel === "abstract_only"))
    .map((source) => ({
      source,
      passages:
        source.accessLevel === "abstract_only"
          ? [source.text.slice(0, PASSAGE_CHARS)]
          : selectPassages(source.text, terms, PASSAGE_CHARS),
    }))
    .filter((p) => p.passages.length);
  return { sources, passages };
}
