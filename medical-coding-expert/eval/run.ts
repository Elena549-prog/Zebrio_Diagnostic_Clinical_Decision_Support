// Live evaluation: runs every eval/cases/*.json through assignMedicalCodes
// (real Claude + Tavily/DuckDuckGo + BfArM), scores it, and writes
// eval/reports/<timestamp>.{md,json}.
// Usage: npm run eval [-- --case <id-substring>]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { assignMedicalCodes, defaultDeps } from "../src/assignMedicalCodes.ts";
import type { SearchAdapter } from "../src/retrieval/types.ts";
import type { CodingResponse } from "../src/types.ts";
import { scoreCase } from "./score.ts";
import type { CaseScore, EvalCase } from "./types.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

const casesDir = new URL("./cases/", import.meta.url);
const reportsDir = new URL("./reports/", import.meta.url);
const filter = process.argv.includes("--case") ? process.argv[process.argv.indexOf("--case") + 1] : undefined;

const cases = readdirSync(casesDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, casesDir), "utf8")) as EvalCase)
  .filter((c) => !filter || c.id.includes(filter));
if (!cases.length) throw new Error(`No cases match ${filter}`);

/** Wraps a search adapter so the runner sees every query sent to the web. */
function recording<T extends SearchAdapter>(adapter: T, log: string[]): T {
  return Object.assign(Object.create(adapter) as T, {
    search: (terms: string, opts: Parameters<SearchAdapter["search"]>[1]) => {
      log.push(`${adapter.name}: ${terms}`);
      return adapter.search(terms, opts);
    },
  });
}

interface CaseRun {
  evalCase: EvalCase;
  response: CodingResponse | null;
  error?: string;
  queries: string[];
  ms: number;
  score: CaseScore;
}

const runs: CaseRun[] = [];
for (const c of cases) {
  const queries: string[] = [];
  const base = defaultDeps();
  const started = Date.now();
  process.stdout.write(`${c.id} ... `);
  let response: CodingResponse | null = null;
  let error: string | undefined;
  try {
    response = await assignMedicalCodes(c.request, {
      deps: { ...base, tavily: recording(base.tavily, queries), duckduckgo: recording(base.duckduckgo, queries) },
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const ms = Date.now() - started;
  const score = response
    ? scoreCase(c, response, queries)
    : { caseId: c.id, passed: false, failures: [`pipeline threw: ${error}`], warnings: [], notes: [], matches: [] };
  runs.push({ evalCase: c, response, error, queries, ms, score });
  console.log(`${score.passed ? "PASS" : "FAIL"} (${(ms / 1000).toFixed(1)} s)${score.failures.map((f) => `\n    - ${f}`).join("")}`);
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function markdown(stamp: string): string {
  const passed = runs.filter((r) => r.score.passed).length;
  const lines = [
    `# Medical coding eval — ${stamp}`,
    "",
    `**${passed}/${runs.length} cases passed.** Live run against Claude, Tavily/DuckDuckGo and the BfArM ICD-10-GM 2026 catalogue.`,
    "",
    "| Case | Lang | Result | Failures | Warnings | Notes | Time |",
    "|---|---|---|---|---|---|---|",
    ...runs.map((r) =>
      `| ${r.evalCase.id} | ${r.evalCase.language} | ${r.score.passed ? "✅ pass" : "❌ fail"} | ${r.score.failures.length} | ${r.score.warnings.length} | ${r.score.notes.length} | ${(r.ms / 1000).toFixed(1)} s |`,
    ),
    "",
  ];
  for (const r of runs) {
    const { evalCase: c, score } = r;
    lines.push(`## ${score.passed ? "✅" : "❌"} ${c.id} — ${c.title}`, "", `Tests: ${c.tests.join(", ")}. Source: ${c.source}.`, "");
    for (const [label, list] of [["Failures", score.failures], ["Warnings", score.warnings], ["Notes", score.notes]] as const) {
      if (list.length) lines.push(`**${label}**`, "", ...list.map((m) => `- ${m}`), "");
    }
    if (r.response) {
      lines.push("| Condition | Assertion | Status | Code | Official label | Candidates | Refs |", "|---|---|---|---|---|---|---|");
      for (const res of r.response.results) {
        lines.push(
          `| ${cell(res.condition)} | ${res.assertion} | ${res.status} | ${res.code ?? "—"} | ${cell(res.officialLabel ?? "—")} | ${(res.candidates ?? []).map((x) => x.code).join(", ") || "—"} | ${res.inputRefs.join(", ")} |`,
        );
      }
      lines.push("", `Search providers: ${r.response.searchProvidersUsed.join(", ") || "none"}.`);
      const extra = r.response.limitations.slice(3);
      if (extra.length) lines.push("", "Run limitations:", ...extra.map((l) => `- ${l}`));
    }
    lines.push("", `Queries: ${r.queries.map((q) => `\`${q}\``).join(", ") || "none"}`, "");
  }
  return lines.join("\n");
}

mkdirSync(reportsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(new URL(`${stamp}.json`, reportsDir), JSON.stringify(runs, null, 2));
writeFileSync(new URL(`${stamp}.md`, reportsDir), markdown(stamp));
const passed = runs.filter((r) => r.score.passed).length;
console.log(`\n${passed}/${runs.length} passed. Report: eval/reports/${stamp}.md`);
process.exitCode = passed === runs.length ? 0 : 1;
