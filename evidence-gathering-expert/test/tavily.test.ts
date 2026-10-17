import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Http } from "../src/retrieve/http.js";
import { fileBudget, memoryBudget, searchGuidelinesTavily } from "../src/retrieve/tavily.js";
import { fakeFetch, json } from "./helpers.js";

const KEY = "tvly-test-key-123";
const http = (f: typeof fetch) => new Http(f, 1000, 0);
const page = (url: string, raw: string) => ({ url, title: `Title of ${url}`, content: "snippet", raw_content: raw, score: 0.9 });
const LONG = "Measure natriuretic peptides in people with suspected heart failure. ".repeat(6);

describe("Tavily guideline adapter", () => {
  it("sends the key as a bearer header, a basic search restricted to guideline domains, and returns page text", async () => {
    let sent: { headers?: HeadersInit; body?: string } = {};
    const f = fakeFetch([
      [
        /api\.tavily\.com\/search/,
        (_url, init) => {
          sent = { headers: init?.headers, body: String(init?.body) };
          return json({ results: [page("https://www.nice.org.uk/guidance/ng106", LONG)] });
        },
      ],
    ]);
    const pages = await searchGuidelinesTavily(http(f), KEY, "heart failure");
    expect((sent.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(sent.body!);
    expect(body).toMatchObject({ search_depth: "basic", include_answer: false, include_raw_content: "text" });
    expect(body.include_domains).toContain("nice.org.uk");
    // Evidence reviews hold the numbers; overview pages don't (live check, 2026-10-17).
    expect(body.query).toBe("heart failure guideline evidence review diagnostic accuracy");
    expect(body.max_results).toBe(3);
    expect(f.calls.join(" ")).not.toContain(KEY);
    expect(pages).toEqual([{ url: "https://www.nice.org.uk/guidance/ng106", title: "Title of https://www.nice.org.uk/guidance/ng106", text: LONG.trim() }]);
  });

  it("drops off-domain results and pages without readable text", async () => {
    const f = fakeFetch([
      [
        /api\.tavily\.com\/search/,
        () =>
          json({
            results: [
              page("https://evil.example.com/nice.org.uk", LONG),
              page("https://www.who.int/short", "too short"),
              page("https://www.who.int/ok", LONG),
            ],
          }),
      ],
    ]);
    expect((await searchGuidelinesTavily(http(f), KEY, "x")).map((p) => p.url)).toEqual(["https://www.who.int/ok"]);
  });

  it("reports an auth or quota error without leaking the key", async () => {
    const f = fakeFetch([[/api\.tavily\.com/, () => json({ detail: { error: "Unauthorized" } }, 401)]]);
    const err = await searchGuidelinesTavily(http(f), KEY, "x").catch((e: Error) => e);
    expect(String((err as Error).message)).toMatch(/401/);
    expect(String((err as Error).message)).not.toContain(KEY);
  });
});

describe("Tavily credit budget", () => {
  it("in memory: allows calls up to the limit, then refuses", async () => {
    const b = memoryBudget(2);
    expect([await b.tryConsume(1), await b.tryConsume(1), await b.tryConsume(1)]).toEqual([true, true, false]);
  });

  it("on disk: counts credits per calendar month and persists between runs", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "tavily-")), "usage.json");
    const october = () => new Date("2026-10-17T12:00:00Z");
    const a = fileBudget(file, 2, october);
    expect(await a.tryConsume(1)).toBe(true);
    const b = fileBudget(file, 2, october); // a new run reads the same file
    expect(await b.tryConsume(1)).toBe(true);
    expect(await b.tryConsume(1)).toBe(false);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ month: "2026-10", credits: 2 });
    const november = fileBudget(file, 2, () => new Date("2026-11-01T00:00:00Z"));
    expect(await november.tryConsume(1)).toBe(true);
  });
});
