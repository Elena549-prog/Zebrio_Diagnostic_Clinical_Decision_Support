import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreCase } from "../eval/score.ts";
import type { EvalCase } from "../eval/types.ts";
import type { CodingResponse, CodingResult } from "../src/types.ts";
import { CATALOGUE_BASE } from "../src/urlPolicy.ts";

const evalCase = (over: Partial<EvalCase> = {}): EvalCase => ({
  id: "t-01",
  title: "test",
  language: "de",
  source: "synthetic",
  sourceNote: "",
  tests: [],
  request: { requestId: "r1", excerpts: [{ id: "ex1", text: "Lobärpneumonie" }, { id: "ex2", text: "Ausschluss LE" }], evidence: [] },
  expected: [
    {
      id: "pneumonia",
      match: { conditionIncludes: ["pneumon"], inputRefs: ["ex1"] },
      assertion: ["documented"],
      status: ["assigned"],
      acceptableCodes: ["J18.1"],
      forbiddenCodes: ["J18.9"],
      notes: "",
    },
  ],
  ...over,
});

const assigned = (code: string, over: Partial<CodingResult> = {}): CodingResult => ({
  condition: "Lobärpneumonie",
  assertion: "documented",
  status: "assigned",
  code,
  officialLabel: "Lobärpneumonie, nicht näher bezeichnet",
  rationale: "",
  inputRefs: ["ex1"],
  references: [
    { url: `${CATALOGUE_BASE}block-j09-j18.htm#${code}`, supportingPassage: `${code} Lobärpneumonie`, retrievedAt: "", retrievalProvider: "direct" },
  ],
  clarificationQuestions: [],
  ...over,
});

const notCoded = (condition: string, assertion: CodingResult["assertion"], inputRefs: string[]): CodingResult => ({
  condition,
  assertion,
  status: "no_supported_code",
  code: null,
  officialLabel: null,
  rationale: "",
  inputRefs,
  references: [],
  clarificationQuestions: [],
});

const response = (results: CodingResult[]): CodingResponse => ({
  requestId: "r1",
  system: "ICD-10-GM",
  edition: "2026",
  results,
  searchProvidersUsed: ["tavily"],
  limitations: [],
});

describe("scoreCase", () => {
  it("passes a correct assignment", () => {
    const s = scoreCase(evalCase(), response([assigned("J18.1")]), []);
    expect(s.failures).toEqual([]);
    expect(s.passed).toBe(true);
  });

  it("fails a forbidden code and a code outside the acceptable list", () => {
    const forbidden = scoreCase(evalCase(), response([assigned("J18.9")]), []);
    expect(forbidden.passed).toBe(false);
    expect(forbidden.failures.join()).toMatch(/forbidden.*J18\.9/i);

    const other = scoreCase(evalCase(), response([assigned("J15.9")]), []);
    expect(other.failures.join()).toMatch(/J15\.9 not acceptable/i);
  });

  it("fails wrong status or assertion", () => {
    const s = scoreCase(evalCase(), response([{ ...notCoded("Lobärpneumonie", "suspected", ["ex1"]), status: "needs_clarification" }]), []);
    expect(s.failures.join()).toMatch(/status/);
    expect(s.failures.join()).toMatch(/assertion/);
  });

  it("fails a missing required condition but not a missing optional one", () => {
    const c = evalCase({
      expected: [
        ...evalCase().expected,
        { id: "pe", required: false, match: { conditionIncludes: ["embol"] }, assertion: ["negated"], status: ["no_supported_code"], notes: "" },
      ],
    });
    expect(scoreCase(c, response([assigned("J18.1")]), []).passed).toBe(true);
    const missing = scoreCase(c, response([]), []);
    expect(missing.failures.join()).toMatch(/pneumonia.*missing/i);
    expect(missing.failures.some((f) => f.startsWith("pe:"))).toBe(false);
  });

  it("matches by input refs so keyword collisions do not swap results", () => {
    const c = evalCase({
      request: { requestId: "r1", excerpts: [{ id: "ex1", text: "" }, { id: "ex3", text: "" }], evidence: [] },
      expected: [
        { id: "own", match: { conditionIncludes: ["infarkt"], inputRefs: ["ex1"] }, assertion: ["documented"], status: ["assigned"], acceptableCodes: ["I21.0"], notes: "" },
        { id: "father", match: { conditionIncludes: ["infarkt", "vater"], inputRefs: ["ex3"] }, assertion: ["family_history"], status: ["no_supported_code"], notes: "" },
      ],
    });
    const results = [notCoded("Myokardinfarkt", "family_history", ["ex3"]), assigned("I21.0", { condition: "Vorderwandinfarkt", inputRefs: ["ex1"] })];
    expect(scoreCase(c, response(results), []).failures).toEqual([]);
  });

  it("fails an unexpected assigned code unless it is allowed", () => {
    const extra = assigned("R06.0", { condition: "Dyspnoe", inputRefs: ["ex2"] });
    expect(scoreCase(evalCase(), response([assigned("J18.1"), extra]), []).failures.join()).toMatch(/unexpected.*R06\.0/i);
    const allowed = evalCase({ allowedExtraCodes: ["R06.0"] });
    expect(scoreCase(allowed, response([assigned("J18.1"), extra]), []).passed).toBe(true);
    const byPrefix = evalCase({ allowedExtraCodePrefixes: ["R06"] });
    expect(scoreCase(byPrefix, response([assigned("J18.1"), extra]), []).passed).toBe(true);
  });

  it("checks case-wide forbidden codes on assignments and candidates", () => {
    const c = evalCase({ forbiddenAssignedCodes: ["C34"], forbiddenCandidateCodes: ["C34"] });
    const withCandidate = assigned("J18.1", {
      candidates: [{ code: "C34.9", officialLabel: "x", entryKind: "terminal", reference: assigned("C34.9").references[0]! }],
    });
    expect(scoreCase(c, response([withCandidate]), []).failures.join()).toMatch(/candidate.*C34\.9/i);
  });

  it("fails when patient identifiers reach a web query", () => {
    const c = evalCase({ forbiddenQueryTerms: ["Mustermann"] });
    expect(scoreCase(c, response([assigned("J18.1")]), ["Lobärpneumonie"]).passed).toBe(true);
    expect(scoreCase(c, response([assigned("J18.1")]), ["mustermann Pneumonie"]).failures.join()).toMatch(/query.*Mustermann/i);
  });

  it("enforces maxAssigned", () => {
    const c = evalCase({ expected: [], maxAssigned: 0 });
    expect(scoreCase(c, response([]), []).passed).toBe(true);
    const s = scoreCase(c, response([assigned("J18.1")]), []);
    expect(s.passed).toBe(false);
  });

  it("rejects an assigned result without a source-checked BfArM reference", () => {
    const noRef = assigned("J18.1", { references: [] });
    expect(scoreCase(evalCase(), response([noRef]), []).failures.join()).toMatch(/reference/i);
    const offDomain = assigned("J18.1", {
      references: [{ url: "https://example.org/j18", supportingPassage: "J18.1", retrievedAt: "", retrievalProvider: "direct" }],
    });
    expect(scoreCase(evalCase(), response([offDomain]), []).failures.join()).toMatch(/BfArM/);
  });

  it("never accepts an assignment for negated, family-history, literature or suspected mentions", () => {
    const c = evalCase({ expected: [] , allowedExtraCodes: ["J18.1"] });
    const s = scoreCase(c, response([assigned("J18.1", { assertion: "negated" })]), []);
    expect(s.failures.join()).toMatch(/negated.*assigned/i);
  });

  it("tolerates needs_clarification for modifier codes but notes the missed ideal code", () => {
    const c = evalCase({
      expected: [
        {
          id: "t2dm",
          match: { conditionIncludes: ["diabet"] },
          assertion: ["documented"],
          status: ["assigned", "needs_clarification"],
          acceptableCodes: ["E11.90"],
          idealCode: "E11.90",
          candidateCodes: ["E11.-"],
          notes: "",
        },
      ],
    });
    const result: CodingResult = {
      ...notCoded("Diabetes mellitus Typ 2", "documented", ["ex1"]),
      status: "needs_clarification",
      candidates: [{ code: "E11.-", officialLabel: "Diabetes mellitus, Typ 2", entryKind: "category", reference: assigned("E11.-").references[0]! }],
    };
    const s = scoreCase(c, response([result]), []);
    expect(s.passed).toBe(true);
    expect(s.notes.join()).toMatch(/ideal.*E11\.90/i);

    const noCandidate = scoreCase(c, response([{ ...result, candidates: [] }]), []);
    expect(noCandidate.warnings.join()).toMatch(/candidate/i);
  });

  it("treats an unavailable pipeline result as a failure", () => {
    const s = scoreCase(evalCase(), response([{ ...notCoded("Lobärpneumonie", "documented", ["ex1"]), status: "unavailable" }]), []);
    expect(s.passed).toBe(false);
  });
});

describe("eval case files", () => {
  const dir = new URL("../eval/cases/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("has 15 cases with unique ids matching their file names", () => {
    expect(files).toHaveLength(15);
    const cases = files.map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as EvalCase);
    cases.forEach((c, i) => expect(`${c.id}.json`).toBe(files[i]));
    expect(new Set(cases.map((c) => c.request.requestId)).size).toBe(15);
  });

  it.each(files)("%s only references input ids and hypotheses that exist", (f) => {
    const c = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as EvalCase;
    const ids = new Set([...c.request.excerpts, ...c.request.evidence].map((x) => x.id));
    const hyps = new Set((c.request.hypotheses ?? []).map((h) => h.id));
    for (const e of c.expected) {
      for (const id of [...(e.match.inputRefs ?? []), ...(e.requiredInputRefs ?? [])]) expect(ids).toContain(id);
      if (e.match.hypothesisId) expect(hyps).toContain(e.match.hypothesisId);
    }
  });
});
