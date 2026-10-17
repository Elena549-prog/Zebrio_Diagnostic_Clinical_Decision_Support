import { describe, expect, it } from "vitest";
import { decodeDuckDuckGoRedirect, isAllowedCatalogueUrl, normalizeCatalogueUrl, toCurrentEditionUrl } from "../src/urlPolicy.ts";

const BASE = "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/";

describe("isAllowedCatalogueUrl", () => {
  it("accepts official 2026 catalogue pages", () => {
    expect(isAllowedCatalogueUrl(`${BASE}block-j40-j47.htm`)).toBe(true);
    expect(isAllowedCatalogueUrl(`${BASE}block-j40-j47.htm#J46`)).toBe(true);
  });

  it.each([
    ["off-domain", "https://www.icd-code.de/icd/code/J46.html"],
    ["lookalike host", "https://klassifikationen.bfarm.de.evil.example/icd-10-gm/kode-suche/htmlgm2026/block-j40-j47.htm"],
    ["subdomain", "https://www.klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/block-j40-j47.htm"],
    ["wrong year", "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2025/block-j40-j47.htm"],
    ["preliminary release", "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2027-vorab/block-j40-j47.htm"],
    ["preliminary in path", `${BASE}vorabfassung/block-j40-j47.htm`],
    ["plain http", "http://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/block-j40-j47.htm"],
    ["path traversal", `${BASE}../htmlgm2025/block-j40-j47.htm`],
    ["credentials in URL", "https://user:pw@klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026/x.htm"],
    ["non-default port", "https://klassifikationen.bfarm.de:8443/icd-10-gm/kode-suche/htmlgm2026/x.htm"],
    ["not a URL", "J46 status asthmaticus"],
  ])("rejects %s", (_label, url) => {
    expect(isAllowedCatalogueUrl(url)).toBe(false);
  });
});

describe("normalizeCatalogueUrl", () => {
  it("drops the fragment and query so pages are fetched once", () => {
    expect(normalizeCatalogueUrl(`${BASE}block-j40-j47.htm?x=1#J46`)).toBe(`${BASE}block-j40-j47.htm`);
  });
});

describe("decodeDuckDuckGoRedirect", () => {
  it("decodes the uddg target locally", () => {
    const target = `${BASE}block-j40-j47.htm`;
    const href = `//duckduckgo.com/l/?uddg=${encodeURIComponent(target)}&rut=abc`;
    expect(decodeDuckDuckGoRedirect(href)).toBe(target);
  });

  it("passes through direct links", () => {
    expect(decodeDuckDuckGoRedirect(`${BASE}x.htm`)).toBe(`${BASE}x.htm`);
  });

  it("returns null for garbage", () => {
    expect(decodeDuckDuckGoRedirect("javascript:alert(1)")).toBeNull();
  });
});

describe("toCurrentEditionUrl", () => {
  it.each([
    "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2026-vorab/block-j40-j47.htm",
    "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2021/block-j40-j47.htm#J46",
  ])("maps %s to the final 2026 page", (url) => {
    expect(toCurrentEditionUrl(url)).toBe(`${BASE}block-j40-j47.htm`);
  });

  it.each([
    "https://www.icd-code.de/icd-10-gm/kode-suche/htmlgm2025/block-j40-j47.htm",
    "https://klassifikationen.bfarm.de/ops/kode-suche/htmlops2026/block-1-10.htm",
    "https://klassifikationen.bfarm.de/icd-10-gm/kode-suche/htmlgm2021/../../x.htm",
  ])("refuses to map %s", (url) => {
    expect(toCurrentEditionUrl(url)).toBeNull();
  });
});
