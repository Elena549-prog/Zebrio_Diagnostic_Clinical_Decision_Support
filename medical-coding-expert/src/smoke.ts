// Live smoke check with real credentials. Prints a short summary, never keys.
//   npm run smoke
// Run 1: normal chain (Tavily first). Run 2: Tavily forced off to exercise
// the DuckDuckGo fallback live.
import { existsSync, readFileSync } from "node:fs";
import { assignMedicalCodes, defaultDeps } from "./assignMedicalCodes.ts";
import type { CodingRequest, CodingResponse } from "./types.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

const request = JSON.parse(readFileSync("examples/request.json", "utf8")) as CodingRequest;

function summary(label: string, r: CodingResponse) {
  console.log(`\n== ${label}`);
  console.log(`providers: ${r.searchProvidersUsed.join(", ") || "(none)"}`);
  for (const x of r.results) {
    console.log(`- ${x.condition} [${x.assertion}] -> ${x.status} ${x.code ?? ""} ${x.officialLabel ?? ""}`);
    for (const ref of x.references) console.log(`    ${ref.url} via ${ref.retrievalProvider}`);
  }
  const extra = r.limitations.slice(3);
  if (extra.length) console.log(`notes:\n  ${extra.join("\n  ")}`);
}

console.log(`ANTHROPIC_API_KEY set: ${Boolean(process.env.ANTHROPIC_API_KEY)}; TAVILY_API_KEY set: ${Boolean(process.env.TAVILY_API_KEY)}`);
summary("normal chain", await assignMedicalCodes(request));
summary(
  "Tavily forced off (DuckDuckGo fallback)",
  await assignMedicalCodes(request, { deps: { ...defaultDeps(), state: { tavilyDisabledReason: "forced off for smoke test" } } }),
);
