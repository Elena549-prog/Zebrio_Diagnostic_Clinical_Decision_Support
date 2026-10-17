/** Bounded retrieval adapters. Search snippets are discovery, never evidence. */
export interface RetrievedPage {
  id: string; url: string; title: string; text: string;
  retrievedAt: string; retrievalProvider: 'tavily' | 'direct';
}
export interface RetrievalResult { pages: RetrievedPage[]; providers: string[]; limitations: string[] }
export interface RetrievalOptions { signal?: AbortSignal; fetcher?: typeof fetch; tavilyKey?: string }
export const ICD_BASE = 'https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/';
const MEDICAL_HOSTS = ['ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'nice.org.uk', 'cdc.gov', 'who.int', 'rki.de', 'awmf.org', 'register.awmf.org', 'gesundheitsinformation.de', 'cochranelibrary.com', 'bmj.com', 'aerzteblatt.de'];
export function allowedIcdUrl(value: unknown): value is string {
  if (typeof value !== 'string' || /[%\\\s]/u.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'klassifikationen.bfarm.de' && !u.port && !u.username && !u.password && !u.search
      && u.pathname.startsWith(new URL(ICD_BASE).pathname) && /^[a-z0-9_.-]+\.htm$/.test(u.pathname.slice(new URL(ICD_BASE).pathname.length));
  } catch { return false; }
}
export function allowedMedicalUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password
      && MEDICAL_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}
export function normalizedText(value: string): string { return value.replace(/\s+/gu, ' ').trim(); }
export function hasPassage(text: string, passage: unknown): passage is string {
  return typeof passage === 'string' && normalizedText(passage).length >= 24 && normalizedText(text).includes(normalizedText(passage));
}
const decodeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
function plainHtml(s: string): string {
  return decodeHtml(s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}
export function duckDuckGoTargets(html: string, coding = true): string[] {
  const allowed = coding ? allowedIcdUrl : allowedMedicalUrl;
  const urls: string[] = [];
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(decodeHtml(m[1]!), 'https://html.duckduckgo.com');
      const target = u.searchParams.get('uddg') || u.href;
      if (allowed(target)) urls.push(target);
    } catch { /* Ignore malformed discovery links. */ }
  }
  return [...new Set(urls)];
}
async function boundedText(response: Response, limit = 400_000): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let value = ''; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw new Error('Retrieval response exceeds size limit');
      value += decoder.decode(chunk.value, { stream: true });
    }
    return value + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function retrievePages(queries: string[], coding: boolean, options: RetrievalOptions = {}): Promise<RetrievalResult> {
  const fetcher = options.fetcher ?? fetch;
  const signal = AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(45_000)]);
  const key = options.tavilyKey ?? process.env.TAVILY_API_KEY;
  const allowed = coding ? allowedIcdUrl : allowedMedicalUrl;
  const providers = new Set<string>(); const limitations: string[] = [];
  const discoveries = new Map<string, string>(); const pages: RetrievedPage[] = [];
  const request = async (url: string, init?: RequestInit) => {
    signal.throwIfAborted();
    const r = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) });
    if (!r.ok) throw new Error(`Retrieval HTTP ${r.status}`);
    return r;
  };
  const post = async (endpoint: string, body: object): Promise<any> => {
    const response = await request('https://api.tavily.com/' + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return JSON.parse(await boundedText(response, 1_000_000));
  };
  if (key) {
    providers.add('tavily');
    try {
      for (const term of queries.slice(0, 2)) {
        const data = await post('search', { query: coding ? `site:${ICD_BASE} ${term} ICD-10-GM 2026` : term,
          include_domains: coding ? ['klassifikationen.bfarm.de'] : MEDICAL_HOSTS,
          max_results: 3, search_depth: 'basic', include_answer: false, include_raw_content: false });
        for (const row of Array.isArray(data.results) ? data.results : []) {
          if (allowed(row.url) && discoveries.size < 3) discoveries.set(row.url, typeof row.title === 'string' ? row.title : row.url);
        }
      }
      if (discoveries.size) {
        const extracted = await post('extract', { urls: [...discoveries.keys()], extract_depth: 'basic', format: 'text' });
        for (const row of Array.isArray(extracted.results) ? extracted.results : []) {
          if (!allowed(row.url) || !discoveries.has(row.url) || typeof row.raw_content !== 'string' || row.raw_content.trim().length < 40) continue;
          pages.push({ id: `N${pages.length + 1}`, url: row.url, title: discoveries.get(row.url)!, text: row.raw_content.slice(0, 45_000), retrievedAt: new Date().toISOString(), retrievalProvider: 'tavily' });
        }
      }
    } catch { signal.throwIfAborted(); limitations.push('Tavily search or extraction failed; upstream details are withheld.'); }
  } else limitations.push('TAVILY_API_KEY is not configured.');
  // Fallback discovery and every fetched redirect remain inside the role's source policy.
  if (pages.length === 0) {
    providers.add('duckduckgo');
    try {
      for (const term of queries.slice(0, 2)) {
        const query = coding ? `site:${ICD_BASE} ${term}` : `${term} (${MEDICAL_HOSTS.map(host => `site:${host}`).join(' OR ')})`;
        const response = await request('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query));
        const html = await boundedText(response);
        if (/anomaly\.js|challenge-form|Unfortunately, bots/i.test(html)) { limitations.push('DuckDuckGo returned a challenge; fallback unavailable.'); break; }
        for (const url of duckDuckGoTargets(html, coding)) if (discoveries.size < 3) discoveries.set(url, url);
      }
    } catch { signal.throwIfAborted(); limitations.push('DuckDuckGo discovery unavailable.'); }
  }
  if (coding || pages.length === 0) {
    for (const [initialUrl, title] of discoveries) {
      if (pages.length >= 3 || pages.some(p => p.url === initialUrl)) continue;
      try {
        let url = initialUrl;
        for (let redirects = 0; redirects <= 3; redirects++) {
          if (!allowed(url)) throw new Error('Disallowed redirect');
          const r = await fetcher(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) });
          if ([301,302,303,307,308].includes(r.status)) {
            const location = r.headers.get('location'); if (!location) throw new Error('Missing redirect target');
            url = new URL(location, url).href; continue;
          }
          if (!r.ok) throw new Error('Source page unavailable');
          const contentType = r.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
          if (contentType && !['text/html', 'text/plain', 'application/xhtml+xml'].includes(contentType)) throw new Error('Unsupported source content type');
          const text = plainHtml(await boundedText(r));
          if (text.length < 40) throw new Error('Empty official page');
          providers.add('direct');
          pages.push({ id: `N${pages.length + 1}`, url, title, text: text.slice(0,45_000), retrievedAt: new Date().toISOString(), retrievalProvider: 'direct' }); break;
        }
      } catch { signal.throwIfAborted(); limitations.push(coding ? 'An official catalogue page could not be retrieved safely.' : 'An allowed medical source page could not be retrieved safely.'); }
    }
  }
  if (!pages.length) limitations.push('No inspected source content is available; search snippets were not treated as evidence.');
  return { pages, providers: [...providers], limitations };
}
