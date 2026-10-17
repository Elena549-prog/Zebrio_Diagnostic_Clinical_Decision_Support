// HTTPS fetch of an already-allowed catalogue page. Redirects are followed
// manually so every hop is checked against the URL policy.

import { isAllowedCatalogueUrl } from "../urlPolicy.ts";
import { ProviderError, toProviderError, withTimeout } from "./errors.ts";
import type { DirectFetcher } from "./types.ts";

const MAX_REDIRECTS = 3;

export function createDirectFetcher(fetchImpl: typeof fetch = fetch): DirectFetcher {
  return async (startUrl, { timeoutMs, signal }) => {
    let url = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedCatalogueUrl(url)) {
        throw new ProviderError("direct", "blocked", `refusing non-catalogue URL ${url}`);
      }
      let res: Response;
      try {
        res = await fetchImpl(url, { redirect: "manual", signal: withTimeout(timeoutMs, signal) });
      } catch (err) {
        throw toProviderError("direct", err);
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new ProviderError("direct", "http", `redirect without location from ${url}`);
        url = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) throw new ProviderError("direct", "http", `HTTP ${res.status} for ${url}`);
      return await res.text();
    }
    throw new ProviderError("direct", "http", "too many redirects");
  };
}
