import { describe, expect, it } from "vitest";
import { retrieveCatalogue } from "../src/retrieval/retrieve.ts";
import { parseDuckDuckGoHtml } from "../src/retrieval/duckduckgo.ts";
import { BLOCK_J40_J47, deps, err, fakeSearch, fakeTavily, testConfig } from "./helpers.ts";

const Q = ["site:klassifikationen.bfarm.de Status asthmaticus J46"];

describe("retrieveCatalogue", () => {
  it("uses Tavily search, then direct fetch when Extract fails", async () => {
    const d = deps();
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(out.searchProvidersUsed).toEqual(["tavily"]);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]!.provider).toBe("direct");
    expect(out.pages[0]!.entries.some((e) => e.code === "J46")).toBe(true);
  });

  it("uses Tavily Extract content when it parses into entries", async () => {
    const tavily = fakeTavily([[BLOCK_J40_J47]], async () => [
      { url: BLOCK_J40_J47, content: "#### J46\nStatus asthmaticus\nInkl.: Akutes schweres Asthma bronchiale" },
    ]);
    const d = deps({ tavily });
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(out.pages[0]!.provider).toBe("tavily");
    expect(d.directCalls).toEqual([]);
  });

  it("retries Tavily once on a transient error before succeeding", async () => {
    const tavily = fakeTavily([err("tavily", "timeout"), [BLOCK_J40_J47]]);
    const d = deps({ tavily });
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(tavily.calls).toHaveLength(2);
    expect(out.searchProvidersUsed).toEqual(["tavily"]);
  });

  it("falls back to DuckDuckGo after Tavily keeps failing", async () => {
    const tavily = fakeTavily([err("tavily", "timeout")]);
    const duckduckgo = fakeSearch("duckduckgo", [[BLOCK_J40_J47]]);
    const d = deps({ tavily, duckduckgo });
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(tavily.calls).toHaveLength(2); // one retry
    expect(out.searchProvidersUsed).toEqual(["duckduckgo"]);
    expect(out.pages[0]!.provider).toBe("direct");
    expect(d.state.tavilyDisabledReason).toBeUndefined();
  });

  it("disables Tavily for the process when credits run out, without retrying", async () => {
    const tavily = fakeTavily([err("tavily", "credits_exhausted")]);
    const duckduckgo = fakeSearch("duckduckgo", [[BLOCK_J40_J47]]);
    const d = deps({ tavily, duckduckgo });
    await retrieveCatalogue(Q, d, testConfig);
    expect(tavily.calls).toHaveLength(1);
    expect(d.state.tavilyDisabledReason).toContain("credits_exhausted");

    // Next request goes straight to DuckDuckGo.
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(tavily.calls).toHaveLength(1);
    expect(out.searchProvidersUsed).toEqual(["duckduckgo"]);
  });

  it("falls back when Tavily answers but only with off-domain pages", async () => {
    const tavily = fakeTavily([["https://www.icd-code.de/icd/code/J46.html"]]);
    const duckduckgo = fakeSearch("duckduckgo", [[BLOCK_J40_J47]]);
    const out = await retrieveCatalogue(Q, deps({ tavily, duckduckgo }), testConfig);
    expect(out.searchProvidersUsed).toEqual(["tavily", "duckduckgo"]);
    expect(out.pages.map((p) => p.url)).toEqual([BLOCK_J40_J47]);
  });

  it("never fetches preliminary / older editions, but finds the same page in the final 2026 catalogue", async () => {
    const duckduckgo = fakeSearch("duckduckgo", [
      [
        "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026-vorab/block-j40-j47.htm",
        "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2021/block-j40-j47.htm",
      ],
    ]);
    const d = deps({ tavily: fakeTavily([err("tavily", "timeout")]), duckduckgo });
    const out = await retrieveCatalogue(Q, d, testConfig);
    expect(d.directCalls).toEqual([BLOCK_J40_J47]);
    expect(out.pages.map((p) => [p.url, p.provider])).toEqual([[BLOCK_J40_J47, "direct"]]);
    expect(out.notes.join(" ")).toContain("other editions");
  });

  it("returns no pages when both providers fail", async () => {
    const out = await retrieveCatalogue(
      Q,
      deps({ tavily: fakeTavily([err("tavily", "auth")]), duckduckgo: fakeSearch("duckduckgo", [err("duckduckgo", "blocked")]) }),
      testConfig,
    );
    expect(out.pages).toEqual([]);
    expect(out.searchProvidersUsed).toEqual([]);
    expect(out.notes.join(" ")).toMatch(/auth.*blocked/s);
  });
});

describe("parseDuckDuckGoHtml", () => {
  it("decodes result redirects", () => {
    const html = `<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(BLOCK_J40_J47)}&amp;rut=x">J46</a>`;
    expect(parseDuckDuckGoHtml(html)).toEqual([BLOCK_J40_J47]);
  });
});
