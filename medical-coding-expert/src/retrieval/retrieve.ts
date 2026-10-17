// Discovery + page retrieval with the agreed fallback chain:
//   Tavily Search (one retry on transient errors)
//     -> DuckDuckGo HTML if Tavily is unusable or finds no allowed page
//   Tavily Extract for pages Tavily discovered
//     -> direct HTTPS fetch if Extract fails or yields no parsable entries
// Credits exhausted / bad key / no key disable Tavily for the rest of the process.

import { parseCatalogueHtml, parseCatalogueText, type CatalogueEntry } from "../catalogue.ts";
import type { CodingConfig } from "../config.ts";
import type { RetrievalProvider, SearchProvider } from "../types.ts";
import { isAllowedCatalogueUrl, normalizeCatalogueUrl, toCurrentEditionUrl } from "../urlPolicy.ts";
import { ProviderError, toProviderError } from "./errors.ts";
import type { DirectFetcher, PageExtractor, SearchAdapter } from "./types.ts";

export interface ProviderState {
  tavilyDisabledReason?: string;
}

/** Shared by every call in this process unless the caller injects its own. */
export const processProviderState: ProviderState = {};

export interface RetrievalDeps {
  tavily: SearchAdapter & PageExtractor;
  duckduckgo: SearchAdapter;
  directFetch: DirectFetcher;
  state: ProviderState;
  now: () => Date;
}

export interface RetrievedPage {
  url: string;
  retrievedAt: string;
  provider: RetrievalProvider;
  entries: CatalogueEntry[];
}

export interface RetrievalOutcome {
  pages: RetrievedPage[];
  searchProvidersUsed: SearchProvider[];
  /** One line per notable failure, for the response's `limitations`. */
  notes: string[];
}

interface SearchRun {
  urls: string[];
  answered: boolean;
  errors: ProviderError[];
}

async function runSearches(
  adapter: SearchAdapter,
  queries: string[],
  retries: number,
  config: CodingConfig,
  signal?: AbortSignal,
): Promise<SearchRun> {
  const run: SearchRun = { urls: [], answered: false, errors: [] };
  for (const query of queries.slice(0, config.maxSearchesPerProvider)) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        run.urls.push(...(await adapter.search(query, { timeoutMs: config.timeoutMs, signal })));
        run.answered = true;
        break;
      } catch (err) {
        const pe = toProviderError(adapter.name, err);
        if (pe.sticky || attempt === retries) {
          run.errors.push(pe);
          if (pe.sticky) return run;
        }
      }
    }
  }
  return run;
}

interface Discovered {
  /** Official 2026 pages found directly. */
  pages: string[];
  /** 2026 pages located via another edition's file name; need a direct fetch. */
  mapped: string[];
}

function allowedPages(urls: string[]): Discovered {
  const out: Discovered = { pages: [], mapped: [] };
  for (const u of urls) {
    if (isAllowedCatalogueUrl(u)) {
      const page = normalizeCatalogueUrl(u);
      if (!out.pages.includes(page)) out.pages.push(page);
      continue;
    }
    const mapped = toCurrentEditionUrl(u);
    if (mapped && !out.mapped.includes(mapped)) out.mapped.push(mapped);
  }
  out.mapped = out.mapped.filter((m) => !out.pages.includes(m));
  return out;
}

export async function retrieveCatalogue(
  queries: string[],
  deps: RetrievalDeps,
  config: CodingConfig,
  signal?: AbortSignal,
): Promise<RetrievalOutcome> {
  const notes: string[] = [];
  const used: SearchProvider[] = [];
  let found: Discovered = { pages: [], mapped: [] };
  let discoveredBy: SearchProvider | null = null;
  const take = (provider: SearchProvider, urls: string[], answered: boolean) => {
    found = allowedPages(urls);
    if (found.pages.length || found.mapped.length) discoveredBy = provider;
    else if (answered) notes.push(`${provider} returned no usable BfArM catalogue page`);
  };

  if (deps.state.tavilyDisabledReason) {
    notes.push(`Tavily skipped: ${deps.state.tavilyDisabledReason}`);
  } else {
    const run = await runSearches(deps.tavily, queries, config.tavilyRetries, config, signal);
    if (run.answered) used.push("tavily");
    for (const e of run.errors) {
      notes.push(e.message);
      if (e.sticky) deps.state.tavilyDisabledReason = e.message;
    }
    take("tavily", run.urls, run.answered);
  }

  if (!discoveredBy) {
    const run = await runSearches(deps.duckduckgo, queries, 0, config, signal);
    if (run.answered) used.push("duckduckgo");
    for (const e of run.errors) notes.push(e.message);
    take("duckduckgo", run.urls, run.answered);
  }

  const pageUrls = [...found.pages, ...found.mapped].slice(0, config.maxPages);
  const mappedUsed = pageUrls.filter((u) => found.mapped.includes(u));
  if (mappedUsed.length) {
    notes.push(
      `Search only found other editions (e.g. preliminary "-vorab"); located the same page in the final 2026 catalogue and verified it there: ${mappedUsed.join(", ")}`,
    );
  }
  const pages: RetrievedPage[] = [];
  const pending = new Set(pageUrls);
  const extractable = pageUrls.filter((u) => found.pages.includes(u));

  if (discoveredBy === "tavily" && extractable.length && !deps.state.tavilyDisabledReason) {
    try {
      const extracted = await deps.tavily.extract(extractable, { timeoutMs: config.timeoutMs, signal });
      for (const page of extracted) {
        if (!isAllowedCatalogueUrl(page.url)) continue;
        const url = normalizeCatalogueUrl(page.url);
        if (!pending.has(url)) continue;
        const entries = parseCatalogueText(page.content);
        if (!entries.length) continue; // let direct fetch try the structured HTML
        pages.push({ url, retrievedAt: deps.now().toISOString(), provider: "tavily", entries });
        pending.delete(url);
      }
    } catch (err) {
      const pe = toProviderError("tavily", err);
      notes.push(`Tavily Extract failed, using direct fetch: ${pe.message}`);
      if (pe.sticky) deps.state.tavilyDisabledReason = pe.message;
    }
  }

  for (const url of pending) {
    try {
      const html = await deps.directFetch(url, { timeoutMs: config.timeoutMs, signal });
      pages.push({ url, retrievedAt: deps.now().toISOString(), provider: "direct", entries: parseCatalogueHtml(html) });
    } catch (err) {
      notes.push(toProviderError("direct", err).message);
    }
  }

  return { pages, searchProvidersUsed: used, notes };
}
