/**
 * demoSuggestions — context-aware, clickable test-result examples shown at the
 * HITL gate so a clinician (or a demo) can fire a realistic result into the
 * engine in one click instead of typing.
 *
 * Each gate derives 3 suggestions from the *live* case state:
 *   1. "Supports the horse"  — a positive result for the proposed test that
 *      backs the leading live hypothesis (the front-runner / "horse").
 *   2. "Points to a zebra"   — a result that supports a zebra (or, if none,
 *      the lowest-ranked live hypothesis) — i.e. the surprising track.
 *   3. "Against the horse"   — a result that contradicts the leader (or is
 *      equivocal), opening the differential back up.
 *
 * The suggestions reference the actual proposed test name and the actual
 * hypothesis names in play, so they read as real clinical sentences rather
 * than placeholders. They're classified by `intent` so the UI can badge them.
 */

import type { Case, Hypothesis } from "./types.js";

export type SuggestionIntent = "horse" | "zebra" | "against";

export interface DemoSuggestion {
  intent: SuggestionIntent;
  /** Short badge label, e.g. "Supports horse". */
  badge: string;
  /** One-line description of what picking this does. */
  hint: string;
  /** Finding summary to send (the "result"). */
  summary: string;
  /** Optional finding detail. */
  detail?: string;
  direction: "supports" | "against" | "neutral";
  hypothesisIds: string[];
  testId?: string;
}

/** Build up to 3 demo suggestions for the current HITL gate. Returns [] when
 *  there's no gate (no proposed test, no live hypotheses). */
export function demoSuggestions(c: Case): DemoSuggestion[] {
  if (!c.awaitingHitl) return [];
  const proposed = c.tests.filter((t) => t.status === "proposed");
  const test = proposed[0];
  const live = Object.values(c.hypotheses)
    .filter((h) => h.status === "live")
    .sort((a, b) => b.probability - a.probability);
  if (live.length === 0) return [];
  const horse = live[0]!;
  const zebra = live.find((h) => h.isZebra);
  // the long-shot if there's no flagged zebra: lowest-probability live hypothesis
  const longShot = zebra ?? [...live].reverse()[0]!;
  const testName = test?.name ?? "the proposed test";

  const out: DemoSuggestion[] = [];

  // 1 — supports the horse. If the proposed test's name mentions a live
  //    hypothesis (e.g. "Malaria RDT" ↔ Malaria), the positive result should
  //    back *that* hypothesis; otherwise back the overall front-runner.
  const namedByTest = live.find((h) => testName.toLowerCase().includes(h.name.toLowerCase().split("(")[0]!.trim()));
  const horseTarget = namedByTest ?? horse;
  out.push({
    intent: "horse",
    badge: namedByTest ? "Test positive" : "Supports horse",
    hint: `Positive ${testName.toLowerCase()} — backs ${horseTarget.name}.`,
    summary: `${testName}: positive`,
    detail: `consistent with ${horseTarget.name}`,
    direction: "supports",
    hypothesisIds: [horseTarget.id],
    testId: test?.id,
  });

  // 2 — points to a zebra / different track
  if (zebra) {
    out.push({
      intent: "zebra",
      badge: "Points to zebra",
      hint: `A result that re-opens ${zebra.name} — the rare track.`,
      summary: `${testName}: equivocal; consider ${zebra.name}-specific workup`,
      detail: `raises ${zebra.name}`,
      direction: "supports",
      hypothesisIds: [zebra.id],
      testId: test?.id,
    });
  } else if (longShot.id !== horse.id) {
    out.push({
      intent: "zebra",
      badge: "Opens long-shot",
      hint: `A result pointing toward ${longShot.name} instead.`,
      summary: `${testName}: pattern favors ${longShot.name}`,
      detail: `differential shifts toward ${longShot.name}`,
      direction: "supports",
      hypothesisIds: [longShot.id],
      testId: test?.id,
    });
  }

  // 3 — against the horse (equivocal / contradicts). Weaken the test's named
  //    hypothesis if there is one, else the overall leader.
  out.push({
    intent: "against",
    badge: namedByTest ? "Test negative" : "Against horse",
    hint: `Negative or inconsistent ${testName.toLowerCase()} — weakens ${horseTarget.name}.`,
    summary: `${testName}: negative / inconclusive`,
    detail: `argues against ${horseTarget.name}; differential stays open`,
    direction: "against",
    hypothesisIds: [horseTarget.id],
    testId: test?.id,
  });

  return out;
}

/** A short human label for an intent, for aria/title. */
export function intentLabel(i: SuggestionIntent): string {
  return i === "horse" ? "supports the leading hypothesis"
    : i === "zebra" ? "points to a rare / alternative hypothesis"
      : "contradicts the leading hypothesis";
}
