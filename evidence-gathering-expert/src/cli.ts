// Thin CLI wrapper: npm run evidence -- examples/sore-throat.request.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gatherEvidence } from "./gather.js";
import { anthropicClient } from "./llm.js";
import { formatCitations } from "./report.js";
import type { EvidenceRequest } from "./types.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run evidence -- <request.json>");
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local at the repo root (see .env.example).");
  process.exit(2);
}

const request = JSON.parse(readFileSync(file, "utf8")) as EvidenceRequest;
const started = Date.now();
const response = await gatherEvidence(request, {
  llm: anthropicClient({ model: process.env.EVIDENCE_MODEL }),
  fetch,
});

mkdirSync("out", { recursive: true });
const outFile = `out/${response.requestId}.json`;
writeFileSync(outFile, JSON.stringify(response, null, 2));

console.log(JSON.stringify(response, null, 2));
console.error(`\n${formatCitations(response)}\n\nSaved ${outFile} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
