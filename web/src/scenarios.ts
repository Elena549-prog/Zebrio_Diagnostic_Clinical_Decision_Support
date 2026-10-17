/**
 * Example patient scenarios for Arbor — seed presentations a clinician might
 * walk through end-to-end: presentation → tests → narrowing → diagnosis → plan.
 *
 * These exercise the features the user asked for: branching, horses-vs-zebras,
 * demographic base-rate adjustment, retraceability, and treatment case-finding.
 */

import type { Presentation } from "./types.js";

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
}

export const SCENARIOS: Scenario[] = [
  {
    id: "scn-tutorial",
    title: "Guided tour — every feature in one case ★",
    blurb:
      "A scripted walk-through of the full run: the differential, horses vs zebras, the test gate, branching, evidence, the working diagnosis, and the treatment plan — with instant stepping and teaching cues. The best place to start.",
    tutorial: true,
    liveScenarioId: "scn-fever-rash",
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
  {
    id: "scn-walkthrough-strep",
    title: "Quick walk-through: sore throat + fever (1–2 rounds)",
    blurb:
      "A second short, clear-cut case to run end-to-end. The engine proposes a rapid strep test; enter the result and watch it converge in 1–2 rounds.",
    presentation: {
      chiefComplaint: "Sore throat and fever for 2 days",
      history:
        "Pain on swallowing, fever 38.6°C, no cough, no runny nose. Otherwise well. No known sick contacts reported.",
      observations: [
        "T 38.6°C, HR 88, BP 118/76",
        "Exudate on tonsils, tender enlarged anterior cervical lymph nodes, no rash",
      ],
      demographics: {
        ageYears: 9,
        sex: "female",
        raceEthnicity: "Northern European",
        location: "Aarhus, Denmark",
        comorbidities: [],
      },
    },
  },
  {
    id: "scn-fever-rash",
    title: "Fever + migrating joint pain (a young adult)",
    blurb:
      "Common viral illness is the horse — but the demographics and pattern make a post-streptococcal and a rare autoimmune zebra worth tracking.",
    presentation: {
      chiefComplaint: "Fever and migrating joint pain for 8 days",
      history:
        "Started with sore throat 2 weeks ago, now large joints (knees, ankles) ache and migrate over days. Fever 38.5–39°C. General malaise. No trauma. No prior similar episodes.",
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
  {
    id: "scn-fat-anemia",
    title: "Fatigue + microcytic anemia (a 58-year-old woman)",
    blurb:
      "Iron deficiency from menorrhagia is the obvious horse — but the geography and ethnicity raise a hemoglobinopathy and a GI-malignancy track to branch.",
    presentation: {
      chiefComplaint: "Progressive fatigue and shortness of breath on exertion for 3 months",
      history:
        "Tired climbing stairs, palpitations, restless legs at night. Diet is varied. No obvious bleeding. Menses ceased 6 years ago.",
      observations: [
        "Hb 9.2 g/dL, MCV 72 fL, ferritin 6 ng/mL (low)",
        "Pallor; no lymphadenopathy; stool negative for visible blood (FIT pending)",
        "T 36.8°C, HR 88, BP 132/82",
      ],
      demographics: {
        ageYears: 58,
        sex: "female",
        raceEthnicity: "West African descent",
        location: "Lisbon, Portugal",
        comorbidities: ["hypertension"],
      },
    },
  },
  {
    id: "scn-headache-papilledema",
    title: "Headache + papilledema (a young woman, BMI high)",
    blurb:
      "Idiopathic intracranial hypertension is the horse by base rate — but the visual field defect signals a zebra (cerebral venous sinus thrombosis) that must not be dropped.",
    presentation: {
      chiefComplaint: "Daily throbbing headache and transient visual loss for 5 weeks",
      history:
        "Worse on bending/straining, sometimes wakes her. Pulsatile tinnitus. Two brief grey-outs on standing. No fever, no neck stiffness. On combined oral contraceptive.",
      observations: [
        "BMI 33.4",
        "Bilateral disc swelling on fundoscopy (papilledema grade 2)",
        "Neuro exam otherwise normal; visual acuity preserved",
        "BP 124/78, afebrile",
      ],
      demographics: {
        ageYears: 27,
        sex: "female",
        raceEthnicity: "South Asian",
        location: "Manchester, UK",
        comorbidities: [],
      },
    },
  },
  {
    id: "scn-cough-weightloss",
    title: "Chronic cough + weight loss (a returning traveler)",
    blurb:
      "Post-viral and reflux are common, but the travel history + demographics drive a tuberculosis vs lymphoma branch that imaging and sputum will split.",
    presentation: {
      chiefComplaint: "Cough for 6 weeks and 6 kg unintentional weight loss",
      history:
        "Productive cough, occasional night sweats, no hemoptysis. Returned 10 weeks ago from 3 months in rural East Africa. Ex-smoker (10 pack-years, quit 5 yrs ago).",
      observations: [
        "BMI 20.1, no clubbing",
        "Crackles at right apex on auscultation",
        "Afebrile today; reports low-grade fevers at night",
      ],
      demographics: {
        ageYears: 44,
        sex: "male",
        raceEthnicity: "East African",
        location: "born Nairobi, now Mombasa, Kenya",
        comorbidities: ["type 2 diabetes"],
      },
    },
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
