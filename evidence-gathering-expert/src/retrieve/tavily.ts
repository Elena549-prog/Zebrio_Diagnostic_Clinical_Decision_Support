// Guideline search via Tavily (primary; DuckDuckGo stays as fallback). One basic search costs
// 1 API credit and already returns the page text, so no second fetch is needed.
// Credits are capped locally so the free plan is never exceeded.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GUIDELINE_DOMAINS, isAllowedGuidelineUrl } from "./duckduckgo.js";
import type { Http } from "./http.js";
import { HttpError } from "./http.js";

const TAVILY_SEARCH = "https://api.tavily.com/search";
/** Credits for one basic search (Tavily pricing: basic = 1, advanced = 2). */
export const CREDITS_PER_SEARCH = 1;

export interface CreditBudget {
  /** Reserve credits before a call; false means the call must not be made. */
  tryConsume(credits: number): boolean | Promise<boolean>;
}

export function memoryBudget(limit: number): CreditBudget {
  let used = 0;
  return {
    tryConsume(credits) {
      if (used + credits > limit) return false;
      used += credits;
      return true;
    },
  };
}

/** Monthly credit counter kept in a small JSON file, so the cap holds across runs. */
export function fileBudget(path: string, monthlyLimit: number, now: () => Date = () => new Date()): CreditBudget {
  return {
    tryConsume(credits) {
      const month = now().toISOString().slice(0, 7);
      let state = { month, credits: 0 };
      try {
        const saved = JSON.parse(readFileSync(path, "utf8")) as typeof state;
        if (saved.month === month && Number.isFinite(saved.credits)) state = saved;
      } catch {
        // No file yet, or unreadable: start counting this month from zero.
      }
      if (state.credits + credits > monthlyLimit) return false;
      state.credits += credits;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state));
      return true;
    },
  };
}

export interface TavilyPage {
  url: string;
  title: string;
  text: string;
}

interface TavilyResult {
  url?: string;
  title?: string;
  raw_content?: string | null;
}

export async function searchGuidelinesTavily(http: Http, apiKey: string, terms: string, maxResults = 3): Promise<TavilyPage[]> {
  const res = await http.request(TAVILY_SEARCH, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Guideline evidence reviews (often long PDFs) state the numbers; overview pages don't.
      query: `${terms} guideline evidence review diagnostic accuracy`,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
      include_raw_content: "text",
      include_domains: GUIDELINE_DOMAINS,
    }),
  });
  if (res.status !== 200) throw new HttpError(`Tavily search HTTP ${res.status}`, res.status);
  const results = (JSON.parse(res.text) as { results?: TavilyResult[] }).results ?? [];
  return results
    .filter((r) => r.url && isAllowedGuidelineUrl(r.url))
    .map((r) => ({ url: r.url!, title: (r.title ?? r.url!).trim(), text: (r.raw_content ?? "").trim() }))
    .filter((p) => p.text.length >= 200);
}
