import { describe, expect, it } from "vitest";
import { assignMedicalCodes, type AssignDeps } from "../src/assignMedicalCodes.ts";
import { ModelUnavailableError, type CodingModel, type InterpretedCondition, type Selection } from "../src/llm/model.ts";
import type { CodingRequest } from "../src/types.ts";
import { BLOCK_J40_J47, deps, err, fakeSearch, fakeTavily, testConfig } from "./helpers.ts";

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

  it("returns unavailable without fabricating codes when both providers fail", async () => {
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
});
