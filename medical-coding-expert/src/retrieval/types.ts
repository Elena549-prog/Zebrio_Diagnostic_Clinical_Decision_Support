import type { SearchProvider } from "../types.ts";

export interface CallOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

/**
 * Replaceable discovery adapter. Takes generic catalogue terms, builds its own
 * provider-specific query, and returns candidate URLs, unfiltered.
 */
export interface SearchAdapter {
  name: SearchProvider;
  search(terms: string, opts: CallOptions): Promise<string[]>;
}

export interface ExtractedPage {
  url: string;
  content: string;
}

export interface PageExtractor {
  extract(urls: string[], opts: CallOptions): Promise<ExtractedPage[]>;
}

/** Fetches one already-allowed catalogue page; returns HTML. */
export type DirectFetcher = (url: string, opts: CallOptions) => Promise<string>;
