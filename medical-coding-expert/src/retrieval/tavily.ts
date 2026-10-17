// Tavily Search + Extract, restricted to the BfArM catalogue host.
// Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search

import { CATALOGUE_HOST } from "../urlPolicy.ts";
import { ProviderError, toProviderError, withTimeout } from "./errors.ts";
import type { ExtractedPage, PageExtractor, SearchAdapter } from "./types.ts";

const API = "https://api.tavily.com";

export function createTavily(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): SearchAdapter & PageExtractor {
  async function post<T>(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    if (!apiKey) throw new ProviderError("tavily", "missing_credentials", "TAVILY_API_KEY is not set");
    let res: Response;
    try {
      res = await fetchImpl(`${API}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: withTimeout(timeoutMs, signal),
      });
    } catch (err) {
      throw toProviderError("tavily", err);
    }
    if (res.ok) return (await res.json()) as T;
    switch (res.status) {
      case 401:
        throw new ProviderError("tavily", "auth", "API key rejected (401)");
      case 432:
      case 433:
        throw new ProviderError("tavily", "credits_exhausted", `usage limit reached (${res.status})`);
      case 429:
        throw new ProviderError("tavily", "rate_limit", "rate limited (429)");
      default:
        throw new ProviderError("tavily", "http", `HTTP ${res.status}`);
    }
  }

  return {
    name: "tavily",

    async search(query, { timeoutMs, signal }) {
      const data = await post<{ results?: { url?: string }[] }>(
        "/search",
        {
          query,
          search_depth: "basic",
          max_results: 5,
          include_domains: [CATALOGUE_HOST],
          include_answer: false,
          include_raw_content: false,
        },
        timeoutMs,
        signal,
      );
      return (data.results ?? []).map((r) => r.url).filter((u): u is string => typeof u === "string");
    },

    async extract(urls, { timeoutMs, signal }): Promise<ExtractedPage[]> {
      const data = await post<{ results?: { url?: string; raw_content?: string }[] }>(
        "/extract",
        { urls, format: "markdown", extract_depth: "basic" },
        timeoutMs,
        signal,
      );
      return (data.results ?? [])
        .filter((r) => typeof r.url === "string" && typeof r.raw_content === "string")
        .map((r) => ({ url: r.url!, content: r.raw_content! }));
    },
  };
}
