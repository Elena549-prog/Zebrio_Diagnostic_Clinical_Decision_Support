// Diagnostic: runs the live demo while logging every outgoing request, its status and size,
// and every model call's task and output. Writes the trace to out/trace.json.
// Never records prompts: the analyse prompt contains the presentation (SPEC.md, Data protection).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gatherEvidence } from "../src/gather.js";
import { anthropicClient } from "../src/llm.js";
import type { EvidenceRequest, LlmClient } from "../src/types.js";

const request = JSON.parse(readFileSync(process.argv[2] ?? "examples/sore-throat.request.json", "utf8")) as EvidenceRequest;
const trace: unknown[] = [];

const tracedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const clone = res.clone();
  const text = await clone.text();
  trace.push({ kind: "http", url: String(input), body: init?.body ? String(init.body) : undefined, status: res.status, bytes: text.length, head: text.slice(0, 300) });
  return res;
};

const real = anthropicClient({ model: process.env.EVIDENCE_MODEL });
const tracedLlm: LlmClient = {
  async complete(req) {
    const out = await real.complete(req);
    // Check/double-check prompts start with the generated question line; nothing else is kept.
    const question = req.task === "analyse" ? undefined : req.user.split("\n")[0];
    trace.push({ kind: "llm", task: req.task, question, userChars: req.user.length, output: out.slice(0, 2000) });
    return out;
  },
};

const res = await gatherEvidence(request, { llm: tracedLlm, fetch: tracedFetch });
mkdirSync("out", { recursive: true });
writeFileSync("out/trace.json", JSON.stringify({ trace, res }, null, 2));
console.log(`status ${res.status}; ${trace.length} trace entries -> out/trace.json`);
