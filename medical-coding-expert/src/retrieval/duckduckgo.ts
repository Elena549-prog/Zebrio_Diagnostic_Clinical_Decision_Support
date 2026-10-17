// DuckDuckGo HTML search surface as the discovery fallback.
// Not a verified API contract: challenge pages (HTTP 202 / "anomaly") are
// treated as "blocked" and never bypassed.

import { CATALOGUE_HOST, decodeDuckDuckGoRedirect } from "../urlPolicy.ts";
import { ProviderError, toProviderError, withTimeout } from "./errors.ts";
import type { SearchAdapter } from "./types.ts";

const ENDPOINT = "https://html.duckduckgo.com/html/";

export function parseDuckDuckGoHtml(html: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"/g)) {
    const decoded = decodeDuckDuckGoRedirect(m[1]!.replace(/&amp;/g, "&"));
    if (decoded) urls.push(decoded);
  }
  return urls;
}

export function createDuckDuckGo(fetchImpl: typeof fetch = fetch): SearchAdapter {
  return {
    name: "duckduckgo",
    async search(terms, { timeoutMs, signal }) {
      // DuckDuckGo returns nothing for site: filters that include a path, so
      // the edition goes in as a keyword; the URL policy does the real filtering.
      const query = `site:${CATALOGUE_HOST} htmlgm2026 ${terms}`;
      let res: Response;
      try {
        res = await fetchImpl(`${ENDPOINT}?q=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": "medical-coding-expert/0.1 (hackathon prototype)" },
          signal: withTimeout(timeoutMs, signal),
        });
      } catch (err) {
        throw toProviderError("duckduckgo", err);
      }
      const body = await res.text();
      const urls = parseDuckDuckGoHtml(body);
      // A challenge page has no results; don't misread a result snippet that says "challenge".
      if (res.status === 202 || (!urls.length && /anomaly-modal|challenge-form/i.test(body))) {
        throw new ProviderError("duckduckgo", "blocked", `challenge page (HTTP ${res.status})`);
      }
      if (res.status === 429) throw new ProviderError("duckduckgo", "rate_limit", "rate limited (429)");
      if (!res.ok) throw new ProviderError("duckduckgo", "http", `HTTP ${res.status}`);
      return urls;
    },
  };
}
