import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.ts";
import { ProviderError } from "../src/retrieval/errors.ts";
import type { RetrievalDeps } from "../src/retrieval/retrieve.ts";
import type { PageExtractor, SearchAdapter } from "../src/retrieval/types.ts";
import { CATALOGUE_BASE } from "../src/urlPolicy.ts";

export const BLOCK_J40_J47 = `${CATALOGUE_BASE}block-j40-j47.htm`;
export const BLOCK_HTML = readFileSync(new URL("./fixtures/pages/block-j40-j47.htm", import.meta.url), "utf8");
export const INDEX_HTML = readFileSync(new URL("./fixtures/pages/index.htm", import.meta.url), "utf8");
export const FIXED_NOW = new Date("2026-10-17T12:00:00.000Z");
export const testConfig = loadConfig({}, { timeoutMs: 1000 });

export type Behaviour = string[] | ProviderError;

export function fakeSearch(name: "tavily" | "duckduckgo", behaviours: Behaviour[]): SearchAdapter & { calls: string[] } {
  const calls: string[] = [];
  return {
    name,
    calls,
    async search(query) {
      calls.push(query);
      const b = behaviours[Math.min(calls.length - 1, behaviours.length - 1)] ?? [];
      if (b instanceof ProviderError) throw b;
      return b;
    },
  };
}

export function fakeTavily(behaviours: Behaviour[], extract?: PageExtractor["extract"]) {
  const s = fakeSearch("tavily", behaviours);
  const extractCalls: string[][] = [];
  return Object.assign(s, {
    extractCalls,
    async extract(urls: string[], opts: { timeoutMs: number }) {
      extractCalls.push(urls);
      // Default: Extract yields nothing usable, so retrieval falls back to direct fetch.
      return extract ? extract(urls, opts) : [];
    },
  });
}

export function deps(over: Partial<RetrievalDeps> = {}): RetrievalDeps & { directCalls: string[] } {
  const directCalls: string[] = [];
  return {
    tavily: fakeTavily([[BLOCK_J40_J47 + "#J46"]]),
    duckduckgo: fakeSearch("duckduckgo", [[]]),
    directFetch: async (url) => {
      directCalls.push(url);
      if (url === BLOCK_J40_J47) return BLOCK_HTML;
      throw new ProviderError("direct", "http", `HTTP 404 for ${url}`);
    },
    state: {},
    now: () => FIXED_NOW,
    ...over,
    directCalls,
  };
}

export const err = (provider: string, kind: ConstructorParameters<typeof ProviderError>[1]) =>
  new ProviderError(provider, kind, kind);
