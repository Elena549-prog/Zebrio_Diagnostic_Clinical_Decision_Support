// Discovery + page retrieval with the agreed fallback chain, per concept:
//   Tavily Search (one retry on transient errors)
//     -> DuckDuckGo HTML if Tavily is unusable or finds no usable page for that concept
//     -> catalogue navigation (index -> block page by code range) if both find nothing
//   Tavily Extract for pages Tavily discovered
//     -> direct HTTPS fetch if Extract fails or yields no parsable entries
// Credits exhausted / bad key / no key disable Tavily for the rest of the process.

import { parseCatalogueHtml, parseCatalogueText, type CatalogueEntry } from "../catalogue.ts";
import type { CodingConfig } from "../config.ts";
import type { RetrievalProvider, SearchProvider } from "../types.ts";
import { isAllowedCatalogueUrl, normalizeCatalogueUrl, toCurrentEditionUrl } from "../urlPolicy.ts";
import { createCatalogueNavigator, likelyCategories } from "./catalogueNavigation.ts";
import { toProviderError } from "./errors.ts";
import type { CallOptions, DirectFetcher, PageExtractor, SearchAdapter } from "./types.ts";

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
  /** Concepts that were searched; later ones exceeded the search budget. */
  searchedTerms: string[];
  /** One line per notable failure, for the response's `limitations`. */
  notes: string[];
}

interface Located {
  url: string;
  /** Found via another edition's file name; must be fetched directly. */
  mapped: boolean;
  by: SearchProvider | "navigation";
}

/** Whether a block page's file name ("block-j40-j47.htm") names a range containing the category. */
function blockCovers(url: string, category: string): boolean {
  const m = /\/block-([a-z]\d{2})-([a-z]\d{2})\.htm/.exec(url);
  return !!m && m[1]!.toUpperCase() <= category && category <= m[2]!.toUpperCase();
}

/** Symptom codes (chapter R) are searched after diagnoses, so a tight budget goes to diagnoses. */
function bySearchPriority(terms: string[]): string[] {
  const isSymptom = (t: string) => likelyCategories(t)[0]?.startsWith("R") ?? false;
  return [...terms.filter((t) => !isSymptom(t)), ...terms.filter(isSymptom)];
}

/** Keep official 2026 pages; map other editions of catalogue pages to their 2026 counterpart. */
function locate(urls: string[], by: SearchProvider): Located[] {
  const out: Located[] = [];
  const add = (url: string, mapped: boolean) => {
    if (!out.some((l) => l.url === url)) out.push({ url, mapped, by });
  };
  for (const u of urls) {
    if (isAllowedCatalogueUrl(u)) add(normalizeCatalogueUrl(u), false);
  }
  for (const u of urls) {
    const mapped = isAllowedCatalogueUrl(u) ? null : toCurrentEditionUrl(u);
    if (mapped) add(mapped, true);
  }
  return out;
}

export async function retrieveCatalogue(
  terms: string[],
  deps: RetrievalDeps,
  config: CodingConfig,
  signal?: AbortSignal,
): Promise<RetrievalOutcome> {
  const notes: string[] = [];
  const used = new Set<SearchProvider>();
  const opts: CallOptions = { timeoutMs: config.timeoutMs, signal };
  const disableTavily = (reason: string) => {
    deps.state.tavilyDisabledReason ??= reason;
  };

  async function searchConcept(adapter: SearchAdapter, term: string, retries: number): Promise<Located[]> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const urls = await adapter.search(term, opts);
        used.add(adapter.name);
        const found = locate(urls, adapter.name);
        if (!found.length) notes.push(`${adapter.name} found no usable BfArM catalogue page for "${term}"`);
        return found;
      } catch (err) {
        const pe = toProviderError(adapter.name, err);
        if (pe.sticky && adapter.name === "tavily") disableTavily(pe.message);
        if (pe.sticky || attempt === retries) {
          notes.push(pe.message);
          return [];
        }
      }
    }
    return [];
  }

  const navigate = createCatalogueNavigator(deps.directFetch);
  async function navigateConcept(term: string, why = `Web search found no usable page for "${term}"`): Promise<Located[]> {
    try {
      const hit = await navigate(term, opts);
      if (!hit) return [];
      notes.push(
        `${why}; located ${hit.url} by navigating the official 2026 catalogue from its index (${hit.locator} used only to pick the block; codes and labels come only from that page)`,
      );
      return [{ url: hit.url, mapped: false, by: "navigation" }];
    } catch (err) {
      notes.push(`Catalogue navigation failed for "${term}": ${toProviderError("direct", err).message}`);
      return [];
    }
  }

  // 1. Discovery, per concept, within the per-provider search budget.
  const searchedTerms = bySearchPriority(terms).slice(0, config.maxSearchesPerProvider);
  const perTerm: Located[][] = [];
  if (deps.state.tavilyDisabledReason) notes.push(`Tavily skipped: ${deps.state.tavilyDisabledReason}`);
  for (const term of searchedTerms) {
    let found: Located[] = [];
    if (!deps.state.tavilyDisabledReason) found = await searchConcept(deps.tavily, term, config.tavilyRetries);
    if (!found.length) found = await searchConcept(deps.duckduckgo, term, 0);
    if (!found.length) found = await navigateConcept(term);
    // Search ranking can return a real but unrelated block page; prefer the
    // block whose range contains the hinted code, keeping search hits after it.
    const hinted = likelyCategories(term)[0];
    if (hinted && found.length && !found.some((l) => blockCovers(l.url, hinted))) {
      const nav = await navigateConcept(term, `Search results for "${term}" cannot contain ${hinted}`);
      found = [...nav, ...found.filter((l) => !nav.some((n) => n.url === l.url))];
    }
    perTerm.push(found);
  }

  // 2. Pick pages round-robin so every concept gets one before any gets two.
  const chosen: Located[] = [];
  for (let rank = 0; chosen.length < config.maxPages && perTerm.some((f) => f.length > rank); rank++) {
    for (const found of perTerm) {
      const l = found[rank];
      if (l && chosen.length < config.maxPages && !chosen.some((c) => c.url === l.url)) chosen.push(l);
    }
  }
  const mapped = chosen.filter((l) => l.mapped).map((l) => l.url);
  if (mapped.length) {
    notes.push(
      `Search only found other editions (e.g. preliminary "-vorab"); located the same page in the final 2026 catalogue and verified it there: ${mapped.join(", ")}`,
    );
  }

  // 3. Retrieval: Tavily Extract for Tavily-discovered official pages, else direct.
  const pages: RetrievedPage[] = [];
  const pending = new Set(chosen.map((l) => l.url));
  const extractable = chosen.filter((l) => l.by === "tavily" && !l.mapped).map((l) => l.url);
  if (extractable.length && !deps.state.tavilyDisabledReason) {
    try {
      for (const page of await deps.tavily.extract(extractable, opts)) {
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
      if (pe.sticky) disableTavily(pe.message);
    }
  }
  for (const url of pending) {
    try {
      const html = await deps.directFetch(url, opts);
      pages.push({ url, retrievedAt: deps.now().toISOString(), provider: "direct", entries: parseCatalogueHtml(html) });
    } catch (err) {
      notes.push(toProviderError("direct", err).message);
    }
  }

  return { pages, searchProvidersUsed: [...used], searchedTerms, notes };
}
