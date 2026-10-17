import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeCode, parseCatalogueHtml, parseCatalogueText } from "../src/catalogue.ts";

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

describe("parseCatalogueText (markdown-ish extract)", () => {
  it("splits on lines that start with a code", () => {
    const text = [
      "#### [J45.9-](https://x#J45.9) Asthma bronchiale, nicht näher bezeichnet",
      "Inkl.: Late-Onset-Asthma",
      "#### J46",
      "Status asthmaticus",
      "Inkl.: Akutes schweres Asthma bronchiale",
      "Siehe auch (J45.-) für weitere",
    ].join("\n");
    const entries = parseCatalogueText(text);
    expect(entries.map((e) => [e.displayCode, e.label, e.entryKind])).toEqual([
      ["J45.9-", "Asthma bronchiale, nicht näher bezeichnet", "category"],
      ["J46", "Status asthmaticus", "terminal"],
    ]);
  });
});

describe("normalizeCode", () => {
  it("strips the category dash and whitespace", () => {
    expect(normalizeCode(" j45.0- ")).toBe("J45.0");
  });
});
