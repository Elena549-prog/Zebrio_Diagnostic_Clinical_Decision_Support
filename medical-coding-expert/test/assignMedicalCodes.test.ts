import { describe, expect, it } from "vitest";
import { assignMedicalCodes, safeSearchTerms, type AssignDeps } from "../src/assignMedicalCodes.ts";
import { ModelUnavailableError, type CodingModel, type InterpretedCondition, type Selection } from "../src/llm/model.ts";
import type { CodingRequest } from "../src/types.ts";
import { CATALOGUE_INDEX_URL } from "../src/retrieval/catalogueNavigation.ts";
import { BLOCK_HTML, BLOCK_J40_J47, deps, err, fakeSearch, fakeTavily, INDEX_HTML, testConfig } from "./helpers.ts";

const request: CodingRequest = {
  requestId: "req-1",
  excerpts: [{ id: "ex1", text: "Patient admitted with status asthmaticus, no response to salbutamol." }],
  evidence: [{ id: "ev1", kind: "patient_finding", text: "SpO2 88% on room air" }],
  hypotheses: [{ id: "h1", name: "Status asthmaticus" }],
};

const cond = (over: Partial<InterpretedCondition> = {}): InterpretedCondition => ({
  condition: "Status asthmaticus",
  hypothesisId: "h1",
  assertion: "documented",
  inputRefs: ["ex1"],
  documentedSpecifics: "",
  searchTerms: "Status asthmaticus J46",
  ...over,
});

const sel = (over: Partial<Selection> = {}): Selection => ({
  conditionIndex: 0,
  decision: "assigned",
  code: "J46",
  candidateCodes: [],
  rationale: "ex1 documents status asthmaticus; BfArM J46 'Status asthmaticus'.",
  clarificationQuestions: [],
  ...over,
});

function fakeModel(conditions: InterpretedCondition[], selections: Selection[] = []): CodingModel & { selectCalls: number } {
  const m = {
    selectCalls: 0,
    async interpret() {
      return { conditions };
    },
    async select() {
      m.selectCalls++;
      return { selections };
    },
  };
  return m;
}

function run(model: CodingModel, over: Partial<AssignDeps> = {}) {
  return assignMedicalCodes(request, { deps: { ...deps(), model, config: testConfig, ...over } });
}

describe("assignMedicalCodes", () => {
  it("assigns a documented condition with official label, link, passage and input refs", async () => {
    const out = await run(fakeModel([cond()], [sel()]));
    expect(out).toMatchObject({ requestId: "req-1", system: "ICD-10-GM", edition: "2026", searchProvidersUsed: ["tavily"] });
    const r = out.results[0]!;
    expect(r).toMatchObject({
      status: "assigned",
      code: "J46",
      officialLabel: "Status asthmaticus",
      hypothesisId: "h1",
      assertion: "documented",
      inputRefs: ["ex1"],
    });
    expect(r.references[0]).toMatchObject({
      url: `${BLOCK_J40_J47}#J46`,
      retrievalProvider: "direct",
      retrievedAt: "2026-10-17T12:00:00.000Z",
    });
    expect(r.references[0]!.supportingPassage).toMatch(/^J46 Status asthmaticus/);
  });

  it("takes the official label from the source, not the model", async () => {
    const out = await run(fakeModel([cond()], [sel({ rationale: "x" })]));
    expect(out.results[0]!.officialLabel).toBe("Status asthmaticus");
  });

  it("rejects a code that is not an entry on a retrieved official page", async () => {
    const out = await run(fakeModel([cond()], [sel({ code: "J96.0" })]));
    const r = out.results[0]!;
    expect(r.status).toBe("no_supported_code");
    expect(r.code).toBeNull();
    expect(r.rationale).toContain("Rejected J96.0");
  });

  it("does not assign a heading for underspecified asthma; returns the category as a candidate", async () => {
    const asthma = cond({ condition: "Asthma bronchiale", searchTerms: "Asthma bronchiale J45" });
    const out = await run(fakeModel([asthma], [sel({ code: "J45.9", decision: "assigned" })]));
    const r = out.results[0]!;
    expect(r.status).toBe("needs_clarification");
    expect(r.code).toBeNull();
    expect(r.candidates?.[0]).toMatchObject({ code: "J45.9-", entryKind: "category", officialLabel: "Asthma bronchiale, nicht näher bezeichnet" });
    expect(r.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it.each([
    ["negated", "absent"],
    ["family_history", "family history"],
    ["literature_only", "literature"],
  ] as const)("never assigns a %s mention and skips retrieval", async (assertion, phrase) => {
    const model = fakeModel([cond({ assertion })], [sel()]);
    const d = deps();
    const out = await run(model, d);
    expect(out.results[0]).toMatchObject({ status: "no_supported_code", code: null, assertion });
    expect(out.results[0]!.rationale.toLowerCase()).toContain(phrase);
    expect(model.selectCalls).toBe(0);
    expect(out.searchProvidersUsed).toEqual([]);
  });

  it("keeps a suspected condition at needs_clarification even if the model says assigned", async () => {
    const out = await run(fakeModel([cond({ assertion: "suspected" })], [sel()]));
    const r = out.results[0]!;
    expect(r.status).toBe("needs_clarification");
    expect(r.code).toBeNull();
    expect(r.candidates?.[0]?.code).toBe("J46");
  });

  it("uses DuckDuckGo when Tavily fails and applies identical checks", async () => {
    const out = await run(fakeModel([cond()], [sel()]), {
      tavily: fakeTavily([err("tavily", "credits_exhausted")]),
      duckduckgo: fakeSearch("duckduckgo", [[BLOCK_J40_J47]]),
      state: {},
    });
    expect(out.searchProvidersUsed).toEqual(["duckduckgo"]);
    expect(out.results[0]).toMatchObject({ status: "assigned", code: "J46" });
  });

  it("assigns J46 from the official page found by catalogue navigation when both search providers fail", async () => {
    const out = await run(fakeModel([cond()], [sel()]), {
      tavily: fakeTavily([err("tavily", "credits_exhausted")]),
      duckduckgo: fakeSearch("duckduckgo", [err("duckduckgo", "blocked")]),
      directFetch: async (url) => (url === CATALOGUE_INDEX_URL ? INDEX_HTML : BLOCK_HTML),
      state: {},
    });
    expect(out.results[0]).toMatchObject({ status: "assigned", code: "J46", officialLabel: "Status asthmaticus" });
    expect(out.results[0]!.references[0]).toMatchObject({ url: `${BLOCK_J40_J47}#J46`, retrievalProvider: "direct" });
    expect(out.searchProvidersUsed).toEqual([]);
    expect(out.limitations.join(" ")).toContain("navigating the official 2026 catalogue");
  });

  it("returns unavailable without fabricating codes when both providers and catalogue navigation fail", async () => {
    const model = fakeModel([cond()], [sel()]);
    const out = await run(model, {
      tavily: fakeTavily([err("tavily", "auth")]),
      duckduckgo: fakeSearch("duckduckgo", [err("duckduckgo", "blocked")]),
      state: {},
    });
    expect(out.results[0]).toMatchObject({ status: "unavailable", code: null, references: [] });
    expect(model.selectCalls).toBe(0);
    expect(out.limitations.join(" ")).toContain("blocked");
  });

  it("returns unavailable results per hypothesis when Claude is unavailable", async () => {
    const model: CodingModel = {
      async interpret() {
        throw new ModelUnavailableError("ANTHROPIC_API_KEY is not set");
      },
      async select() {
        throw new Error("unreachable");
      },
    };
    const out = await run(model);
    expect(out.results).toEqual([expect.objectContaining({ condition: "Status asthmaticus", hypothesisId: "h1", status: "unavailable" })]);
    expect(out.limitations.join(" ")).toContain("ANTHROPIC_API_KEY");
  });

  it("notes when the refusal fallback answered", async () => {
    const model: CodingModel = {
      async interpret() {
        return { conditions: [cond()], servedByFallback: "claude-opus-4-8" };
      },
      async select() {
        return { selections: [sel()] };
      },
    };
    const out = await run(model);
    expect(out.limitations.join(" ")).toContain("fallback model claude-opus-4-8");
  });

  it("drops input and hypothesis ids the model invented", async () => {
    const out = await run(fakeModel([cond({ inputRefs: ["ex1", "ex99"], hypothesisId: "h42" })], [sel()]));
    expect(out.results[0]!.inputRefs).toEqual(["ex1"]);
    expect(out.results[0]!.hypothesisId).toBeUndefined();
  });

  it("marks conditions beyond the search budget as unavailable instead of guessing", async () => {
    const conditions = [
      cond(),
      cond({ condition: "B", searchTerms: "Bronchitis" }),
      cond({ condition: "C", searchTerms: "Emphysem" }),
    ];
    const out = await run(fakeModel(conditions, [sel()]));
    expect(out.results.map((r) => r.status)).toEqual(["assigned", "unavailable", "unavailable"]);
    expect(out.results[1]!.rationale).toContain("No coding decision");
    expect(out.results[2]!.rationale).toContain("budget");
  });
});

describe("safeSearchTerms", () => {
  it("keeps catalogue wording and drops long digit runs", () => {
    expect(safeSearchTerms(cond({ searchTerms: "Status asthmaticus J46 20261017" }), request)).toBe("Status asthmaticus J46");
  });

  it("falls back to the condition name when terms copy the record", () => {
    const leaky = cond({ searchTerms: "admitted with status asthmaticus, no response to salbutamol" });
    expect(safeSearchTerms(leaky, request)).toBe("Status asthmaticus");
  });
});
