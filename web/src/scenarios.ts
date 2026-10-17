/**
 * Example patient scenarios for Zebrio Diagnostic Clinical Decision Support — seed presentations a clinician might
 * walk through end-to-end: presentation → tests → narrowing → diagnosis → plan.
 *
 * These exercise the features the user asked for: branching, horses-vs-zebras,
 * demographic base-rate adjustment, retraceability, and treatment case-finding.
 */

import type { Presentation } from "./types.js";
import { GOLDEN_BREATHLESSNESS, GOLDEN_CHEST_PAIN, GOLDEN_DYSURIA } from "./goldenScenarios.js";

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  presentation: Presentation;
  /**
   * When true, this card enters the guided tutorial (a scripted, canned
   * walk-through) instead of starting a live case against the API. The
   * tutorial's "Run this case for real" exit starts the named `liveScenarioId`.
   */
  tutorial?: boolean;
  liveScenarioId?: string;
  /** The recommended live demo: real Claude/Tavily calls on a synthetic patient. */
  liveDemo?: boolean;
  /**
   * Synthetic results a presenter may type at the test gate. They are not
   * canned: the live model chooses the tests, and only the clinician records
   * a result.
   */
  syntheticResults?: string[];
  /**
   * Set for the team's golden examples: the presentation is the request file's
   * `presentation`, unchanged (see goldenScenarios.ts).
   */
  golden?: { requestId: string; sourceFile: string };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "scn-tutorial",
    title: "Guided tour — every feature in one case ★",
    blurb:
      "A scripted walk-through of the full run: the differential, horses vs zebras, the test gate, branching, evidence, the working diagnosis, and the treatment plan — with instant stepping and teaching cues. The best place to start.",
    tutorial: true,
    presentation: {
      chiefComplaint: "Fever and migrating joint pain for 8 days",
      history:
        "Started with a sore throat 2 weeks ago, now large joints (knees, ankles) ache and migrate over days. Fever 38.5–39°C. General malaise. No trauma. No prior similar episodes.",
      observations: [
        "T 38.7°C, HR 102, BP 118/74, RR 18",
        "Swollen tender left knee, right ankle — warm but not erythematous",
        "No mucosal lesions, no tick bite recalled",
      ],
      demographics: {
        ageYears: 19,
        sex: "male",
        raceEthnicity: "Northern European",
        location: "rural Minnesota, USA",
        comorbidities: [],
      },
    },
  },
  GOLDEN_BREATHLESSNESS,
  GOLDEN_CHEST_PAIN,
  GOLDEN_DYSURIA,
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
