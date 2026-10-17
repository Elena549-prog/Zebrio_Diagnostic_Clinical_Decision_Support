// Step 5 (VERIFY): code, not the model, decides what counts as evidence.
// The checker model only proposes; everything here is deterministic.
import { NUMBER_FIELDS, type CheckerFinding, type NumberField, type Question, type VerifiedFinding } from "./internal.js";
import type { ItemStatus, StoredSource } from "./types.js";

const CAN_SUPPORT = new Set(["full_text", "abstract_only"]);
const PLACEHOLDER_HOST = /(^|\.)(example\.(org|com|net|edu)|[\w-]+\.(invalid|test|example|localhost)|localhost)$|^127\.|^0\.0\.0\.0$/i;
const INSTRUCTION_LIKE = /ignore (all |any )?(previous|prior|above|your) instructions|disregard (the|all|your) instructions|system prompt|you are now|mark (every|all|this) (claim|item|question)s? as/i;
const MIN_QUOTE_CHARS = 15;
const PROPORTION_FIELDS = new Set<string>(["value", "sensitivity", "specificity"]);

export function normalise(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/­/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every number written in the text, read both as decimal-comma and thousands-comma. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of normalise(text).matchAll(/\d+(?:[.,]\d+)*/g)) {
    const raw = m[0];
    out.push(Number(raw.replace(/,/g, "")));
    if (/^\d+,\d+$/.test(raw)) out.push(Number(raw.replace(",", ".")));
  }
  return out.filter(Number.isFinite);
}

function numberStated(n: number, quote: string, proportion: boolean): boolean {
  return numbersIn(quote).some((q) => Math.abs(q - n) < 1e-6 || (proportion && Math.abs(q - n * 100) < 1e-6));
}

export function isPlaceholderUrl(url: string): boolean {
  try {
    return PLACEHOLDER_HOST.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

export interface VerifyResult {
  accepted: VerifiedFinding[];
  rejected: { finding: CheckerFinding; why: string }[];
}

export function verifyFindings(question: Question, findings: CheckerFinding[], sources: Map<string, StoredSource>): VerifyResult {
  const accepted: VerifiedFinding[] = [];
  const rejected: VerifyResult["rejected"] = [];
  const fields = NUMBER_FIELDS[question.kind];

  for (const f of findings) {
    const reject = (why: string) => rejected.push({ finding: f, why });
    const src = sources.get(f.sourceId);
    if (!src) { reject(`unknown source ${f.sourceId}`); continue; }
    if (isPlaceholderUrl(src.url)) { reject(`placeholder host ${src.url}`); continue; }
    if (!CAN_SUPPORT.has(src.accessLevel)) { reject(`${src.accessLevel} content cannot support`); continue; }
    const quote = normalise(f.quote ?? "");
    if (quote.length < MIN_QUOTE_CHARS) { reject("quote too short"); continue; }
    if (INSTRUCTION_LIKE.test(quote)) { reject("quote contains instructions, not evidence"); continue; }
    if (!normalise(src.text).includes(quote)) { reject(`quote not found in ${f.sourceId}`); continue; }
    if (accepted.some((a) => a.sourceId === f.sourceId && a.stance === f.stance)) {
      reject("same study already counted");
      continue;
    }

    const notes: string[] = [];
    const numbers: VerifiedFinding["numbers"] = {};
    for (const field of fields) {
      const n = f.numbers?.[field];
      if (n == null) continue;
      if (typeof n === "number" && numberStated(n, f.quote, PROPORTION_FIELDS.has(field))) numbers[field] = n;
      else notes.push(`Checker reported ${field} = ${n}, but the quote does not state it; dropped.`);
    }
    const ci = f.numbers?.ci95;
    if (ci && ci.length === 2) {
      const prop = question.kind === "prior";
      if (ci.every((n) => typeof n === "number" && numberStated(n, f.quote, prop))) numbers.ci95 = ci;
      else notes.push(`Checker reported 95% CI ${ci.join("–")}, but the quote does not state it; dropped.`);
    }
    // Context phrases must be written in the retrieved source (often the sentence before the quote).
    const sourceText = normalise(src.text);
    const stated = (s: string | null) => (s && sourceText.includes(normalise(s)) ? s : null);

    accepted.push({
      ...f,
      numbers,
      population: stated(f.population),
      setting: stated(f.setting),
      denominator: stated(f.denominator),
      notes,
      doubleCheck: "skipped",
    });
  }
  return { accepted, rejected };
}

export interface DecidedItem {
  status: ItemStatus;
  note?: string;
  value?: number | null;
  lrPositive?: number | null;
  lrNegative?: number | null;
  sensitivity?: number | null;
  specificity?: number | null;
  ci95: [number, number] | null;
  population: string | null;
  setting: string | null;
  denominator: string | null;
  missing: string[];
  /** The findings this item rests on, in rank order (for evidence ids). */
  used: VerifiedFinding[];
}

function hasNumber(f: VerifiedFinding, fields: readonly NumberField[]) {
  return fields.some((k) => typeof f.numbers[k] === "number");
}

/**
 * Turn verified findings into one calculator-ready item.
 * `considered` is every source offered for this question, best-ranked first.
 */
export function decideItem(question: Question, accepted: VerifiedFinding[], considered: StoredSource[]): DecidedItem {
  const fields = NUMBER_FIELDS[question.kind];
  const rank = (f: VerifiedFinding) => {
    const i = considered.findIndex((s) => s.id === f.sourceId);
    return i < 0 ? Infinity : i;
  };
  const sorted = [...accepted].sort((a, b) => rank(a) - rank(b));
  const notes = sorted.flatMap((f) => f.notes);
  const usable = sorted.filter((f) => f.doubleCheck !== "disagreed");
  const supports = usable.filter((f) => f.stance === "supports" && hasNumber(f, fields));
  const contradicts = usable.filter((f) => f.stance === "contradicts");
  if (usable.some((f) => f.stance === "supports" && !hasNumber(f, fields))) {
    notes.push("A passage was relevant but stated none of the requested numbers.");
  }

  let status: ItemStatus;
  if (supports.length && contradicts.length) {
    status = "conflicting";
    notes.push(`Sources disagree: ${contradicts.map((c) => `${c.sourceId}: ${c.reason}`).join("; ")}`);
  } else if (supports.length) status = "supported";
  else if (contradicts.length) status = "contradicted";
  else if (considered.length && considered.every((s) => !CAN_SUPPORT.has(s.accessLevel))) status = "inaccessible";
  else status = "insufficient";

  const primary = supports[0] ?? contradicts[0];
  if (supports.length > 1) {
    const others = supports.slice(1).map((s) => `${s.sourceId}: ${fields.map((k) => s.numbers[k]).filter((n) => n != null).join("/")}`);
    notes.push(`Other studies report: ${others.join("; ")}. Values shown are from the best-ranked source; nothing was averaged.`);
  }

  const item: DecidedItem = {
    status,
    ci95: primary?.numbers.ci95 ?? null,
    population: primary?.population ?? null,
    setting: primary?.setting ?? null,
    denominator: primary?.denominator ?? null,
    missing: [],
    used: sorted,
  };
  for (const k of fields) item[k] = primary?.numbers[k] ?? null;
  for (const k of [...fields, "ci95", "population", "setting", "denominator"] as const) {
    if (item[k] == null) item.missing.push(k);
  }
  if (notes.length) item.note = notes.join(" ");
  return item;
}
