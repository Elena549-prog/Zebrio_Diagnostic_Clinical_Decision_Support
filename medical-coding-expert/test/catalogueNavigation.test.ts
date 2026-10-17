import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_INDEX_URL,
  createCatalogueNavigator,
  findRange,
  likelyCategories,
  parseBlockLinks,
  parseChapterLinks,
} from "../src/retrieval/catalogueNavigation.ts";
import { ProviderError } from "../src/retrieval/errors.ts";
import { CATALOGUE_BASE } from "../src/urlPolicy.ts";

const page = (name: string) => readFileSync(new URL(`./fixtures/pages/${name}`, import.meta.url), "utf8");
const INDEX = page("index.htm");
const CHAPTER_X = page("chapter-x.htm");
const opts = { timeoutMs: 1000 };

describe("likelyCategories", () => {
  it("reads codes from search terms as three-character categories", () => {
    expect(likelyCategories("Status asthmaticus J46")).toEqual(["J46"]);
    expect(likelyCategories("Asthma bronchiale J45.0- j45.9")).toEqual(["J45"]);
    expect(likelyCategories("Diabetes E11.90 oder E14")).toEqual(["E11", "E14"]);
  });

  it("ignores words, URLs and terms without a code", () => {
    expect(likelyCategories("site:klassifikationen.bfarm.de htmlgm2026 Status asthmaticus")).toEqual([]);
    expect(likelyCategories("COVID19 B2B")).toEqual([]);
  });
});

describe("parsing the real 2026 index and chapter X", () => {
  const blocks = parseBlockLinks(INDEX);
  const chapters = parseChapterLinks(INDEX);

  it("lists all 22 chapters with their ranges", () => {
    expect(chapters).toHaveLength(22);
    expect(chapters.find((c) => c.from === "J00")).toEqual({ url: `${CATALOGUE_BASE}chapter-x.htm`, from: "J00", to: "J99" });
  });

  it("lists block pages only as official 2026 URLs", () => {
    expect(blocks.length).toBeGreaterThan(200);
    expect(blocks.every((b) => b.url.startsWith(CATALOGUE_BASE) && /block-[a-z]\d{2}-[a-z]\d{2}\.htm$/.test(b.url))).toBe(true);
  });

  it("chapter X lists its own blocks, not the links to other chapters", () => {
    const x = parseBlockLinks(CHAPTER_X);
    expect(x.map((b) => `${b.from}-${b.to}`)).toEqual([
      "J00-J06", "J09-J18", "J20-J22", "J30-J39", "J40-J47", "J60-J70", "J80-J84", "J85-J86", "J90-J94", "J95-J99",
    ]);
  });

  it.each([
    ["J46", "block-j40-j47.htm"],
    ["J40", "block-j40-j47.htm"], // lower boundary
    ["J47", "block-j40-j47.htm"], // upper boundary
    ["J39", "block-j30-j39.htm"],
    ["J60", "block-j60-j70.htm"],
    ["A00", "block-a00-a09.htm"],
  ])("finds %s in %s", (code, file) => {
    expect(findRange(blocks, code)?.url).toBe(`${CATALOGUE_BASE}${file}`);
  });

  it("finds no block for a gap in the catalogue", () => {
    expect(findRange(blocks, "J50")).toBeUndefined();
  });

  it("compares chapter ranges across letters", () => {
    expect(findRange(chapters, "T20")?.url).toBe(`${CATALOGUE_BASE}chapter-xix.htm`);
    expect(findRange(chapters, "J45")?.url).toBe(`${CATALOGUE_BASE}chapter-x.htm`);
  });
});

describe("createCatalogueNavigator", () => {
  function fetcher(pages: Record<string, string>) {
    const calls: string[] = [];
    const fetchPage = async (url: string) => {
      calls.push(url);
      const html = pages[url];
      if (html === undefined) throw new ProviderError("direct", "http", `HTTP 404 for ${url}`);
      return html;
    };
    return { calls, fetchPage };
  }

  it("goes from the index to the block for a category like J45.0", async () => {
    const f = fetcher({ [CATALOGUE_INDEX_URL]: INDEX });
    const locate = createCatalogueNavigator(f.fetchPage);
    expect(await locate("Asthma bronchiale J45.0-", opts)).toEqual({ url: `${CATALOGUE_BASE}block-j40-j47.htm`, locator: "J45" });
    expect(await locate("Status asthmaticus J46", opts)).toMatchObject({ url: `${CATALOGUE_BASE}block-j40-j47.htm` });
    expect(f.calls).toEqual([CATALOGUE_INDEX_URL]); // index fetched once per request
  });

  it("follows the chapter page when the index has no block list", async () => {
    const chaptersOnly = INDEX.replace(/<a href="block-[^"]*"[^>]*>[^<]*<\/a>/g, "");
    const f = fetcher({ [CATALOGUE_INDEX_URL]: chaptersOnly, [`${CATALOGUE_BASE}chapter-x.htm`]: CHAPTER_X });
    const hit = await createCatalogueNavigator(f.fetchPage)("Status asthmaticus J46", opts);
    expect(hit?.url).toBe(`${CATALOGUE_BASE}block-j40-j47.htm`);
    expect(f.calls).toEqual([CATALOGUE_INDEX_URL, `${CATALOGUE_BASE}chapter-x.htm`]);
  });

  it("fetches nothing when the terms name no code", async () => {
    const f = fetcher({});
    expect(await createCatalogueNavigator(f.fetchPage)("Status asthmaticus", opts)).toBeNull();
    expect(f.calls).toEqual([]);
  });
});
