// Step 3: RETRIEVE. Papers first (Europe PMC, PubMed fallback), guidelines via DuckDuckGo.
// Every query is built here from search terms only, never from patient text.
import type { Question } from "../internal.js";
import { findingLabel } from "../analyse.js";
import { paperSource, rankSources, SourceStore } from "../sources.js";
import type { Config, ErrorEntry, StoredSource } from "../types.js";
import { fetchGuidelinePage, ProviderBlocked, searchGuidelines } from "./duckduckgo.js";
import type { Http, ProviderHealth } from "./http.js";
import { fetchEuropePmcFullText, searchEuropePmc, searchPubMed, type PaperRecord } from "./papers.js";
import { selectPassages } from "./text.js";

export interface RetrieveContext {
  http: Http;
  health: ProviderHealth;
  store: SourceStore;
  now: () => Date;
  config: Config;
  errors: ErrorEntry[];
  fullText: Map<string, Promise<string | null>>;
  guidelines: Map<string, Promise<StoredSource[]>>;
}

export interface Retrieved {
  sources: StoredSource[];
  passages: { source: StoredSource; passages: string[] }[];
}

const PASSAGE_CHARS = 3500;

const phrase = (t: string) => (t.includes(" ") ? `"${t}"` : t);

function ageTerms(band: string | null): string | null {
  if (band === "0–4" || band === "5–15") return "(child OR children OR paediatric OR pediatric)";
  if (band === "65+") return "(elderly OR older OR aged)";
  return null;
}

export function paperQuery(q: Question, problem: string): string {
  const parts = [phrase(q.diagnosis.searchTerm)];
  if (q.kind === "prior") {
    parts.push("(prevalence OR incidence OR proportion OR aetiology OR etiology)");
    if (problem) parts.push(phrase(problem));
  } else {
    parts.push(phrase(q.finding!.searchTerm));
    parts.push('("likelihood ratio" OR sensitivity OR specificity OR "diagnostic accuracy" OR "clinical score")');
  }
  const age = ageTerms(q.ageBand);
  if (age) parts.push(age);
  return parts.join(" AND ");
}

async function searchPapers(q: Question, problem: string, ctx: RetrieveContext): Promise<PaperRecord[]> {
  const query = paperQuery(q, problem);
  const { health, http, errors } = ctx;
  if (!health.disabled("europepmc")) {
    try {
      const r = await searchEuropePmc(http, query, 15);
      health.ok("europepmc");
      if (r.length) return r;
    } catch (e) {
      health.fail("europepmc");
      errors.push({ step: "retrieve", question: q.text, message: `Europe PMC: ${(e as Error).message}` });
    }
  }
  if (!health.disabled("pubmed")) {
    try {
      const r = await searchPubMed(http, query, 8);
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
  // Rank on what each record promises before downloading anything.
  const prelim = records.map((r) =>
    paperSource(r, r.isOpenAccess && r.pmcid ? "full_text" : r.abstract ? "abstract_only" : "paywalled", "", at()),
  );
  const top = rankSources(prelim).slice(0, ctx.config.maxSourcesPerQuestion);
  const out: StoredSource[] = [];
  for (const p of top) {
    const r = records.find((x) => (x.pmcid ?? x.pmid ?? x.doi) === (p.pmcid ?? p.pmid ?? p.doi))!;
    const full = p.accessLevel === "full_text" ? await fullTextOf(p.pmcid!, ctx) : null;
    const source = full
      ? paperSource(r, "full_text", full, at())
      : r.abstract
        ? paperSource(r, "abstract_only", r.abstract, at())
        : paperSource(r, "paywalled", "", at());
    out.push(ctx.store.add(source));
  }
  return out;
}

function guidelinesFor(q: Question, problem: string, ctx: RetrieveContext): Promise<StoredSource[]> {
  const key = q.diagnosis.id;
  let p = ctx.guidelines.get(key);
  if (!p) {
    p = (async () => {
      if (ctx.health.disabled("duckduckgo")) return [];
      let urls: string[];
      try {
        urls = await searchGuidelines(ctx.http, [q.diagnosis.searchTerm, problem].filter(Boolean).join(" "), 1);
        ctx.health.ok("duckduckgo");
      } catch (e) {
        ctx.health.fail("duckduckgo");
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
    })();
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
