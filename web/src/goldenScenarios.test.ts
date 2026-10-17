// Run by the server test script (`npm test`), which uses tsx --test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS, findScenario } from "./scenarios.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const goldenDir = join(repoRoot, "examples", "golden");

function readJson(file: string): any {
  return JSON.parse(readFileSync(join(goldenDir, file), "utf8"));
}

const requestFiles = [
  ...readdirSync(goldenDir).filter((f) => f.endsWith(".request.json")),
  ...readdirSync(join(goldenDir, "extra")).filter((f) => f.endsWith(".request.json")).map((f) => `extra/${f}`),
].sort();
const goldenScenarios = SCENARIOS.filter((s) => s.golden);

test("the app offers the guided tour plus three golden live scenarios", () => {
  assert.deepEqual(
    SCENARIOS.map((s) => s.id),
    ["scn-tutorial", "scn-golden-breathlessness", "scn-golden-chest-pain", "scn-golden-dysuria"],
  );
  assert.equal(SCENARIOS.filter((s) => s.tutorial).length, 1);
});

test("every golden scenario maps to its own existing request file", () => {
  const mapped = goldenScenarios.map((s) => s.golden!.sourceFile);
  assert.equal(new Set(mapped).size, mapped.length);
  for (const f of mapped) assert.ok(requestFiles.includes(f.replace("examples/golden/", "")), f);
});

test("golden scenario presentation is the request presentation, unchanged", () => {
  for (const s of goldenScenarios) {
    const request = readJson(s.golden!.sourceFile.replace("examples/golden/", ""));
    assert.equal(s.golden!.requestId, request.requestId);
    // Read from disk, not via the import, so a hand-copied drift would fail.
    assert.deepEqual(s.presentation, request.presentation, s.id);
  }
});

test("breathlessness is the prominent live golden preset", () => {
  const s = findScenario("scn-golden-breathlessness");
  assert.ok(s);
  assert.equal(s.liveDemo, true);
  assert.notEqual(s.tutorial, true);
  assert.equal(s.golden?.requestId, "golden-2-breathlessness");
  // Right after the guided tour.
  const ids = SCENARIOS.map((x) => x.id);
  assert.equal(ids[0], "scn-tutorial");
  assert.equal(ids[1], "scn-golden-breathlessness");
  assert.equal(findScenario("scn-tutorial")?.tutorial, true);
  assert.match(s.title + s.blurb, /synthetic/i);
  assert.match(s.blurb, /real Claude \+ Tavily/i);
});

test("golden scenarios do not leak expected diagnoses or the saved response", () => {
  const response = readJson("golden-2-breathlessness.response.json");
  const forbidden = [
    // Team-expected leading diagnoses (examples/golden/README.md).
    "coronary heart disease",
    "angina",
    "heart failure",
    "cystitis",
    "pneumonia",
    "pulmonary embolism",
    // Saved population figures that must not read as patient risk.
    "47%",
    "18%",
    "0.47",
    "0.18",
    "pubmed",
    ...response.diagnoses.map((d: { diagnosis: string }) => d.diagnosis.toLowerCase()),
  ];
  for (const s of goldenScenarios) {
    const text = JSON.stringify(s).toLowerCase();
    for (const term of forbidden) assert.ok(!text.includes(term), `${s.id} contains "${term}"`);
  }
});

test("synthetic result sheet is labelled and stays out of the intake", () => {
  for (const s of SCENARIOS) {
    for (const r of s.syntheticResults ?? []) {
      assert.match(r, /synthetic/i, `${s.id}: ${r}`);
      assert.ok(!JSON.stringify(s.presentation).includes(r), `${s.id} result leaked into presentation`);
    }
  }
});

