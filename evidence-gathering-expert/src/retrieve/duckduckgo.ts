// Guideline discovery via DuckDuckGo Lite (no key, no official API). Small and replaceable.
// Blocks and challenges are reported, never bypassed.
import { htmlToText } from "./text.js";
import type { Http } from "./http.js";
import { HttpError } from "./http.js";

export const GUIDELINE_DOMAINS = [
  "nice.org.uk",
  "cdc.gov",
  "who.int",
  "idsociety.org",
  "awmf.org",
  "sst.dk",
  "escmid.org",
];

const LITE = "https://lite.duckduckgo.com/lite/";
const MAX_REDIRECTS = 3;

export class ProviderBlocked extends HttpError {}

export function isAllowedGuidelineUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return GUIDELINE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** DuckDuckGo wraps some links as //duckduckgo.com/l/?uddg=<target>; unwrap them locally. */
function unwrap(href: string): string {
  const decoded = href.replace(/&amp;/g, "&");
  try {
    const u = new URL(decoded, "https://duckduckgo.com");
    if (u.hostname.endsWith("duckduckgo.com") && u.pathname === "/l/") return u.searchParams.get("uddg") ?? "";
    return u.toString();
  } catch {
    return "";
  }
}

export function guidelineQuery(terms: string): string {
  return `${terms} guideline (${GUIDELINE_DOMAINS.map((d) => `site:${d}`).join(" OR ")})`;
}

export async function searchGuidelines(http: Http, terms: string, max = 3): Promise<string[]> {
  const res = await http.request(LITE, {
    method: "POST",
    body: new URLSearchParams({ q: guidelineQuery(terms) }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (res.status !== 200 || /anomaly|captcha|challenge-form/i.test(res.text)) {
    throw new ProviderBlocked(`DuckDuckGo unavailable (HTTP ${res.status}${res.status === 200 ? ", challenge page" : ""})`, res.status);
  }
  const urls = [...res.text.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map((m) => unwrap(m[1]!)).filter(isAllowedGuidelineUrl);
  return [...new Set(urls)].slice(0, max);
}

export type GuidelinePage =
  | { ok: true; url: string; title: string; text: string }
  | { ok: false; url: string; reason: string };

/** Fetch an allowed guideline page, validating every redirect hop. */
export async function fetchGuidelinePage(http: Http, url: string): Promise<GuidelinePage> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedGuidelineUrl(current)) return { ok: false, url, reason: `redirect to disallowed URL ${current}` };
    const res = await http.get(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, url, reason: `redirect without location (HTTP ${res.status})` };
      current = new URL(next, current).toString();
      continue;
    }
    if (res.status !== 200) return { ok: false, url: current, reason: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { ok: false, url: current, reason: `unsupported content type ${type || "unknown"}` };
    const { title, text } = htmlToText(res.text);
    if (text.length < 200) return { ok: false, url: current, reason: "no readable text" };
    return { ok: true, url: current, title: title || current, text };
  }
  return { ok: false, url, reason: "too many redirects" };
}
