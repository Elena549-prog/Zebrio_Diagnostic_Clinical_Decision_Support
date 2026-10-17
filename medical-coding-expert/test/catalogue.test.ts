import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeEntities, normalizeCode, parseCatalogueHtml, parseCatalogueText } from "../src/catalogue.ts";

const html = readFileSync(new URL("./fixtures/pages/block-j40-j47.htm", import.meta.url), "utf8");

describe("parseCatalogueHtml (real BfArM 2026 page J40-J47)", () => {
  const entries = parseCatalogueHtml(html);
  const byCode = new Map(entries.map((e) => [e.code, e]));

  it("finds every code anchor on the page", () => {
    expect(entries.map((e) => e.code)).toContain("J46");
    expect(entries.length).toBe(24);
  });

  it("reads J46 as a terminal code with its official German label", () => {
    const j46 = byCode.get("J46")!;
    expect(j46.label).toBe("Status asthmaticus");
    expect(j46.entryKind).toBe("terminal");
    expect(j46.notes).toContain("Akutes schweres Asthma bronchiale");
  });

  it("marks J45.0- as a category that needs a 5th digit", () => {
    const j450 = byCode.get("J45.0")!;
    expect(j450.displayCode).toBe("J45.0-");
    expect(j450.entryKind).toBe("category");
    expect(j450.label).toBe("Vorwiegend allergisches Asthma bronchiale");
  });

  it("keeps notes scoped to one entry (J46 is only mentioned inside J45's exclusions)", () => {
    const j45 = byCode.get("J45")!;
    expect(j45.notes).toContain("Status asthmaticus");
    expect(j45.label).toBe("Asthma bronchiale");
  });
});

const tavilyMarkdown = readFileSync(new URL("./fixtures/pages/block-j40-j47.tavily.md", import.meta.url), "utf8");

describe("parseCatalogueText (real Tavily Extract markdown of the same page)", () => {
  const entries = parseCatalogueText(tavilyMarkdown);
  const byCode = new Map(entries.map((e) => [e.code, e]));

  it("finds the same entries as the HTML parser", () => {
    expect(entries.map((e) => e.displayCode)).toEqual(parseCatalogueHtml(html).map((e) => e.displayCode));
  });

  it("agrees with the HTML parser on labels and kinds", () => {
    for (const e of parseCatalogueHtml(html)) {
      expect([byCode.get(e.code)?.label, byCode.get(e.code)?.entryKind]).toEqual([e.label, e.entryKind]);
    }
  });

  it("never starts an entry from a cross-reference in a note or bullet", () => {
    const tricky = ["#### J45.- Asthma bronchiale", "Exkl.:", ":   Status asthmaticus ([J46](#J46))", "J46 Fake label on its own line", "* J46 also fake"].join("\n");
    expect(parseCatalogueText(tricky).map((e) => e.code)).toEqual(["J45"]);
  });
});

describe("decodeEntities", () => {
  it("does not double-decode and handles hex entities", () => {
    expect(decodeEntities("&amp;lt; &#x00E4; &#228;")).toBe("&lt; ä ä");
  });
});

describe("normalizeCode", () => {
  it("strips the category dash and whitespace", () => {
    expect(normalizeCode(" j45.0- ")).toBe("J45.0");
  });
});
