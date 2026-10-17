/**
 * Golden presets — the team's three synthetic golden examples, wired in as
 * live scenarios.
 *
 * The presentation is imported straight from `examples/golden/*.request.json`
 * and passed through unchanged, so the app and the evidence expert always run
 * the same story. Only the request files are imported. The saved response and
 * summary for example 2 are a recorded evidence run for the stage; they are
 * never shown or sent during a live case. Team "expected" diagnoses live in
 * the examples README and are deliberately not part of these presets.
 */

import chestPain from "../../examples/golden/golden-1-chest-pain.request.json";
import breathlessness from "../../examples/golden/golden-2-breathlessness.request.json";
import dysuria from "../../examples/golden/golden-3-dysuria.request.json";
import type { Scenario } from "./scenarios.js";
import type { Presentation, Sex } from "./types.js";

interface GoldenRequest {
  requestId: string;
  presentation: {
    chiefComplaint: string;
    history?: string;
    observations?: string[];
    demographics: {
      ageYears?: number;
      sex?: string;
      raceEthnicity?: string;
      location?: string;
      comorbidities?: string[];
    };
  };
}

const SEXES: readonly Sex[] = ["male", "female", "intersex", "unknown"];

/** Narrow the JSON's `sex` string to the app type; reject anything else. */
export function goldenPresentation(request: GoldenRequest): Presentation {
  const sex = request.presentation.demographics.sex;
  if (sex !== undefined && !SEXES.includes(sex as Sex)) {
    throw new Error(`${request.requestId}: unsupported sex "${sex}"`);
  }
  return request.presentation as Presentation;
}

export const GOLDEN_REQUESTS = {
  "golden-1-chest-pain": chestPain,
  "golden-2-breathlessness": breathlessness,
  "golden-3-dysuria": dysuria,
} satisfies Record<string, GoldenRequest>;

function golden(requestId: keyof typeof GOLDEN_REQUESTS): Pick<Scenario, "presentation" | "golden"> {
  const request = GOLDEN_REQUESTS[requestId];
  return {
    presentation: goldenPresentation(request),
    golden: { requestId, sourceFile: `examples/golden/${requestId}.request.json` },
  };
}

export const GOLDEN_BREATHLESSNESS: Scenario = {
  id: "scn-golden-breathlessness",
  title: "Golden live preset ★ — breathlessness, 79-year-old woman (Kiel)",
  blurb:
    "Team golden example 2: a synthetic patient, sent verbatim from examples/golden. Real Claude + Tavily calls each round; nothing pre-recorded is shown. The saved evidence run in examples/golden is a separate stage artifact, not used here.",
  liveDemo: true,
  syntheticResults: [
    "ECG (synthetic, not in golden source): atrial fibrillation, ventricular rate 104/min, no acute ST changes",
    "Chest X-ray (synthetic, not in golden source): cardiomegaly, upper-lobe venous diversion, small bilateral pleural effusions, no focal consolidation",
    "Transthoracic echocardiogram (synthetic, not in golden source): LVEF 35%, dilated left ventricle",
  ],
  ...golden("golden-2-breathlessness"),
};

export const GOLDEN_CHEST_PAIN: Scenario = {
  id: "scn-golden-chest-pain",
  title: "Golden — chest pressure on exertion, 64-year-old man (Leipzig)",
  blurb:
    "Team golden example 1: a synthetic patient, sent verbatim from examples/golden. Live Claude + Tavily calls; you type any test results yourself.",
  ...golden("golden-1-chest-pain"),
};

export const GOLDEN_DYSURIA: Scenario = {
  id: "scn-golden-dysuria",
  title: "Golden — burning on urination, 27-year-old woman (Munich)",
  blurb:
    "Team golden example 3: a synthetic patient, sent verbatim from examples/golden. Live Claude + Tavily calls; you type any test results yourself.",
  ...golden("golden-3-dysuria"),
};
