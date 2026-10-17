// examples/response.json is the integration fixture for Person 3. It is
// produced offline from the real BfArM page fixture with a scripted model,
// and this test fails if the code drifts from it.
// Regenerate with: UPDATE_FIXTURE=1 npx vitest run test/exampleResponse.test.ts

import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assignMedicalCodes } from "../src/assignMedicalCodes.ts";
import type { CodingModel } from "../src/llm/model.ts";
import type { CodingRequest } from "../src/types.ts";
import { deps, testConfig } from "./helpers.ts";

const requestPath = new URL("../examples/request.json", import.meta.url);
const responsePath = new URL("../examples/response.json", import.meta.url);

const scripted: CodingModel = {
  async interpret() {
    return {
      conditions: [
        { condition: "Status asthmaticus", hypothesisId: "h1", assertion: "documented", inputRefs: ["ex1", "ev1"], documentedSpecifics: "acute severe, refractory to salbutamol", searchTerms: "Status asthmaticus J46" },
        { condition: "Pneumonia", hypothesisId: "h2", assertion: "negated", inputRefs: ["ex2"], documentedSpecifics: "", searchTerms: "Pneumonie" },
        { condition: "Type 2 diabetes mellitus (mother)", hypothesisId: null, assertion: "family_history", inputRefs: ["ex3"], documentedSpecifics: "", searchTerms: "Diabetes mellitus Typ 2" },
        { condition: "Pneumothorax", hypothesisId: null, assertion: "literature_only", inputRefs: ["ev2"], documentedSpecifics: "", searchTerms: "Pneumothorax" },
      ],
    };
  },
  async select() {
    return {
      selections: [
        {
          conditionIndex: 0,
          decision: "assigned",
          code: "J46",
          candidateCodes: [],
          rationale: "ex1 documents status asthmaticus and ev1 shows severe hypoxaemia; BfArM J46 'Status asthmaticus' includes 'Akutes schweres Asthma bronchiale'.",
          clarificationQuestions: [],
        },
      ],
    };
  },
};

it("examples/response.json matches the current implementation", async () => {
  const request = JSON.parse(readFileSync(requestPath, "utf8")) as CodingRequest;
  const response = await assignMedicalCodes(request, { deps: { ...deps(), model: scripted, config: testConfig } });
  const json = JSON.stringify(response, null, 2) + "\n";
  if (process.env.UPDATE_FIXTURE) writeFileSync(responsePath, json);
  expect(json).toBe(readFileSync(responsePath, "utf8"));
});
