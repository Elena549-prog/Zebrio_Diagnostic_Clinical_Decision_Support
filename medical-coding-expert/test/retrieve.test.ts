import { describe, expect, it } from "vitest";
import { retrieveCatalogue } from "../src/retrieval/retrieve.ts";
import { createDuckDuckGo, parseDuckDuckGoHtml } from "../src/retrieval/duckduckgo.ts";
import { CATALOGUE_INDEX_URL } from "../src/retrieval/catalogueNavigation.ts";
import { ProviderError } from "../src/retrieval/errors.ts";
import { BLOCK_HTML, BLOCK_J40_J47, deps, err, fakeSearch, fakeTavily, INDEX_HTML, testConfig } from "./helpers.ts";

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
      { url: BLOCK_J40_J47, content: "#### J46 Status asthmaticus\n\nInkl.:\n:   Akutes schweres Asthma bronchiale" },
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

describe("retrieveCatalogue per concept", () => {
  it("falls back to DuckDuckGo only for the concept Tavily could not find", async () => {
    const other = BLOCK_J40_J47.replace("block-j40-j47", "block-e10-e14");
    const tavily = fakeTavily([[BLOCK_J40_J47], []]);
    const duckduckgo = fakeSearch("duckduckgo", [[other]]);
    const out = await retrieveCatalogue(["Status asthmaticus", "Diabetes mellitus Typ 2"], deps({ tavily, duckduckgo }), testConfig);
    expect(tavily.calls).toEqual(["Status asthmaticus", "Diabetes mellitus Typ 2"]);
    expect(duckduckgo.calls).toEqual(["Diabetes mellitus Typ 2"]);
    expect(out.searchProvidersUsed).toEqual(["tavily", "duckduckgo"]);
  });

  it("searches at most maxSearchesPerProvider concepts and reports which", async () => {
    const out = await retrieveCatalogue(["a", "b", "c"], deps(), testConfig);
    expect(out.searchedTerms).toEqual(["a", "b"]);
  });
});

describe("retrieveCatalogue catalogue navigation", () => {
  const serving = (calls: string[]) => async (url: string) => {
    calls.push(url);
    if (url === CATALOGUE_INDEX_URL) return INDEX_HTML;
    if (url === BLOCK_J40_J47) return BLOCK_HTML;
    throw new ProviderError("direct", "http", `HTTP 404 for ${url}`);
  };
  const searchFails = () => ({
    tavily: fakeTavily([err("tavily", "credits_exhausted")]),
    duckduckgo: fakeSearch("duckduckgo", [err("duckduckgo", "blocked")]),
  });

  it("navigates from the official index to the block page when both search providers fail", async () => {
    const calls: string[] = [];
    const out = await retrieveCatalogue(["Status asthmaticus J46"], deps({ ...searchFails(), directFetch: serving(calls) }), testConfig);
    expect(calls).toEqual([CATALOGUE_INDEX_URL, BLOCK_J40_J47]);
    expect(out.pages.map((p) => [p.url, p.provider])).toEqual([[BLOCK_J40_J47, "direct"]]);
    expect(out.pages[0]!.entries.some((e) => e.code === "J46")).toBe(true);
    expect(out.searchProvidersUsed).toEqual([]);
    expect(out.notes.join(" ")).toContain("navigating the official 2026 catalogue");
  });

  it("is not used when DuckDuckGo finds a page", async () => {
    const calls: string[] = [];
    const out = await retrieveCatalogue(
      ["Status asthmaticus J46"],
      deps({ tavily: fakeTavily([err("tavily", "auth")]), duckduckgo: fakeSearch("duckduckgo", [[BLOCK_J40_J47]]), directFetch: serving(calls) }),
      testConfig,
    );
    expect(calls).toEqual([BLOCK_J40_J47]);
    expect(out.notes.join(" ")).not.toContain("navigating");
  });

  it("is not used when Tavily finds a page", async () => {
    const calls: string[] = [];
    await retrieveCatalogue(["Status asthmaticus J46"], deps({ directFetch: serving(calls) }), testConfig);
    expect(calls).not.toContain(CATALOGUE_INDEX_URL);
  });

  it("is used only for the concept search could not find, and stays within maxPages", async () => {
    const calls: string[] = [];
    const tavily = fakeTavily([[BLOCK_J40_J47], []]);
    const out = await retrieveCatalogue(
      ["Status asthmaticus J46", "Pneumonie J18.9"],
      deps({ tavily, duckduckgo: fakeSearch("duckduckgo", [[]]), directFetch: serving(calls) }),
      { ...testConfig, maxPages: 1 },
    );
    expect(calls).toContain(CATALOGUE_INDEX_URL); // navigation ran for "Pneumonie J18.9"
    expect(out.pages.map((p) => p.url)).toEqual([BLOCK_J40_J47]);
    expect(calls.filter((u) => u.includes("block-"))).toEqual([BLOCK_J40_J47]);
  });

  it("notes a failed navigation and returns no pages", async () => {
    const out = await retrieveCatalogue(["Status asthmaticus J46"], deps(searchFails()), testConfig);
    expect(out.pages).toEqual([]);
    expect(out.notes.join(" ")).toContain("Catalogue navigation failed");
  });
});

describe("parseDuckDuckGoHtml", () => {
  it("decodes result redirects", () => {
    const html = `<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(BLOCK_J40_J47)}&amp;rut=x">J46</a>`;
    expect(parseDuckDuckGoHtml(html)).toEqual([BLOCK_J40_J47]);
  });
});

describe("createDuckDuckGo", () => {
  const respond = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;
  const link = `<a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(BLOCK_J40_J47)}">x</a>`;

  it("does not mistake a result snippet mentioning 'challenge' for a block", async () => {
    const ddg = createDuckDuckGo(respond(200, `${link}<p>a clinical challenge</p>`));
    expect(await ddg.search("x", { timeoutMs: 1000 })).toEqual([BLOCK_J40_J47]);
  });

  it("reports a real challenge page as blocked", async () => {
    const ddg = createDuckDuckGo(respond(202, `<form id="challenge-form"></form>`));
    await expect(ddg.search("x", { timeoutMs: 1000 })).rejects.toMatchObject({ kind: "blocked" });
  });
});
