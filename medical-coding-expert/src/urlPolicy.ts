// The only place that decides whether a URL may be cited or fetched.
// Every search result, redirect target, and reference passes through here.

export const CATALOGUE_HOST = "klassifikationen.bfarm.de";
export const CATALOGUE_PATH = "/icd-10-gm/kode-suche/htmlgm2026/";
export const CATALOGUE_BASE = `https://${CATALOGUE_HOST}${CATALOGUE_PATH}`;

export function isAllowedCatalogueUrl(raw: string): boolean {
  // Reject traversal before URL parsing silently resolves it.
  if (raw.includes("..")) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname !== CATALOGUE_HOST) return false;
  if (url.port !== "") return false;
  if (url.username || url.password) return false;
  if (!url.pathname.startsWith(CATALOGUE_PATH)) return false;
  if (/vorab/i.test(url.pathname)) return false;
  return true;
}

/**
 * Search indexes often hold the preliminary ("-vorab") or an older edition of
 * a catalogue page. Use only its file name as a locator for the same page in
 * the final 2026 edition; that page is then fetched and verified itself.
 * The other edition is never fetched or cited.
 */
export function toCurrentEditionUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== CATALOGUE_HOST || url.port || url.username || url.password) return null;
  const m = url.pathname.match(/^\/icd-10-gm\/kode-suche\/htmlgm\d{4}(?:-vorab)?\/([a-z0-9-]+\.htm)$/);
  if (!m) return null;
  const mapped = `${CATALOGUE_BASE}${m[1]}`;
  return isAllowedCatalogueUrl(mapped) ? mapped : null;
}

/** Page identity for fetching and de-duplication: no query, no fragment. */
export function normalizeCatalogueUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  url.search = "";
  return url.toString();
}

/**
 * DuckDuckGo HTML results link through //duckduckgo.com/l/?uddg=<target>.
 * Decode locally so we never request the redirector itself.
 */
export function decodeDuckDuckGoRedirect(href: string): string | null {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname === "/l/") {
      const target = url.searchParams.get("uddg");
      return target ? new URL(target).toString() : null;
    }
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    return null;
  } catch {
    return null;
  }
}
