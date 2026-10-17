// Last-resort page discovery without web search: walk the official 2026
// catalogue from its index to the block page whose code range contains a
// likely code. The code (from the model's search terms) is only a locator;
// the block page is still fetched, parsed and verified like any other.

import { CATALOGUE_BASE, isAllowedCatalogueUrl } from "../urlPolicy.ts";
import type { CallOptions, DirectFetcher } from "./types.ts";

export const CATALOGUE_INDEX_URL = `${CATALOGUE_BASE}index.htm`;

export interface CodeRange {
  url: string;
  /** Three-character category codes, inclusive, e.g. "J40" .. "J47". */
  from: string;
  to: string;
}

/** Three-character categories named in search terms: "Status asthmaticus J46" -> ["J46"], "J45.0-" -> ["J45"]. */
export function likelyCategories(terms: string): string[] {
  const out: string[] = [];
  for (const m of terms.matchAll(/(?<![\p{L}\p{N}])([A-Za-z]\d{2})(?:\.\d{1,2})?-?(?![\p{L}\p{N}])/gu)) {
    const code = m[1]!.toUpperCase();
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

function toUrl(href: string): string | null {
  const url = new URL(href, CATALOGUE_BASE).toString();
  return isAllowedCatalogueUrl(url) ? url : null;
}

/** Block links ("block-j40-j47.htm" labelled "J40-J47") on the index or a chapter page. */
export function parseBlockLinks(html: string): CodeRange[] {
  const out: CodeRange[] = [];
  const re = /<a href="(block-([a-z]\d{2})-([a-z]\d{2})\.htm)"[^>]*class="code"[^>]*>([A-Z]\d{2})-([A-Z]\d{2})<\/a>/g;
  for (const m of html.matchAll(re)) {
    const [, href, fileFrom, fileTo, from, to] = m as unknown as string[];
    // File name and link text must name the same range.
    if (fileFrom!.toUpperCase() !== from || fileTo!.toUpperCase() !== to) continue;
    const url = toUrl(href!);
    if (url && !out.some((r) => r.url === url)) out.push({ url, from: from!, to: to! });
  }
  return out;
}

/** Chapter rows on the index: "chapter-x.htm" (X) next to its range "J00-J99". */
export function parseChapterLinks(html: string): CodeRange[] {
  const out: CodeRange[] = [];
  const re = /<a href="(chapter-[ivx]+\.htm)"[^>]*>([IVX]+)<\/a><\/td><td><a href="#\2"[^>]*>([A-Z]\d{2})-([A-Z]\d{2})<\/a>/g;
  for (const m of html.matchAll(re)) {
    const url = toUrl(m[1]!);
    if (url) out.push({ url, from: m[3]!, to: m[4]! });
  }
  return out;
}

/** Letter + two digits compare correctly as strings, also across letters (S00-T98). */
export function findRange(ranges: CodeRange[], category: string): CodeRange | undefined {
  return ranges.find((r) => r.from <= category && category <= r.to);
}

export interface NavigationHit {
  url: string;
  locator: string;
}

/**
 * One navigator per request, so the index is fetched at most once. The index
 * lists every block; the chapter page is only followed if it does not.
 * Every fetch goes through the direct fetcher's per-hop URL policy.
 */
export function createCatalogueNavigator(fetchPage: DirectFetcher) {
  let index: Promise<string> | undefined;
  return async function locate(terms: string, opts: CallOptions): Promise<NavigationHit | null> {
    for (const category of likelyCategories(terms)) {
      index ??= fetchPage(CATALOGUE_INDEX_URL, opts);
      const html = await index;
      let block = findRange(parseBlockLinks(html), category);
      const chapter = block ? undefined : findRange(parseChapterLinks(html), category);
      if (chapter) block = findRange(parseBlockLinks(await fetchPage(chapter.url, opts)), category);
      if (block) return { url: block.url, locator: category };
    }
    return null;
  };
}
