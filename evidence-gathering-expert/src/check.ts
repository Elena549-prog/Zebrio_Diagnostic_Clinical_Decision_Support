// Steps 4 and 4b: CHECK and DOUBLE-CHECK. Separate calls, fresh context each time.
import { parseJson } from "./llm.js";
import { CHECK_SCHEMA, CHECK_SYSTEM, DOUBLE_CHECK_SCHEMA, DOUBLE_CHECK_SYSTEM } from "./prompts.js";
import type { CheckerFinding, Question, VerifiedFinding } from "./internal.js";
import { NUMBER_FIELDS } from "./internal.js";
import { findingLabel } from "./analyse.js";
import type { LlmClient, StoredSource } from "./types.js";

/** Neutralise anything in retrieved text that could close our wrapper tags. */
const escapeData = (s: string) => s.replace(/<\/?source\b[^>]*>/gi, "[tag removed]");

function describeQuestion(q: Question): string {
  return [
    `Question: ${q.text}`,
    `Diagnosis: ${q.diagnosis.name}`,
    q.finding && `Finding: ${findingLabel(q.finding)}`,
    `Requested numbers: ${NUMBER_FIELDS[q.kind].join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

interface RawCheck {
  findings: (Omit<CheckerFinding, "numbers"> & {
    numbers: Record<string, number | null> & { ci95Low?: number | null; ci95High?: number | null };
  })[];
}

export async function check(
  llm: LlmClient,
  q: Question,
  passages: { source: StoredSource; passages: string[] }[],
): Promise<CheckerFinding[]> {
  const body = passages
    .map(
      ({ source, passages: ps }) =>
        `<source id="${source.id}" title="${escapeData(source.title).replace(/"/g, "'")}" type="${source.studyType}" access="${source.accessLevel}">\n${ps.map(escapeData).join("\n\n")}\n</source>`,
    )
    .join("\n\n");
  const raw = parseJson<RawCheck>(
    await llm.complete({ task: "check", system: CHECK_SYSTEM, user: `${describeQuestion(q)}\n\n${body}`, schema: CHECK_SCHEMA }),
    "check",
  );
  if (!Array.isArray(raw.findings)) throw new Error("check: findings missing");
  return raw.findings.map((f) => {
    const { ci95Low, ci95High, ...rest } = f.numbers ?? {};
    return {
      ...f,
      limitations: f.limitations ?? [],
      numbers: { ...rest, ci95: ci95Low != null && ci95High != null ? [ci95Low, ci95High] : null },
    };
  });
}

export async function doubleCheck(llm: LlmClient, q: Question, f: VerifiedFinding, source: StoredSource) {
  const numbers = Object.entries(f.numbers)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("–") : v}`)
    .join(", ");
  const user = [
    describeQuestion(q),
    `Source: ${source.title} (${source.studyType}, ${source.year ?? "year unknown"})`,
    `Population stated: ${f.population ?? "not stated"}`,
    `Extracted numbers: ${numbers || "none"}`,
    `<quote>\n${escapeData(f.quote)}\n</quote>`,
  ].join("\n");
  return parseJson<{ agree: boolean; populationMismatchOnly?: boolean; reason: string }>(
    await llm.complete({ task: "double-check", system: DOUBLE_CHECK_SYSTEM, user, schema: DOUBLE_CHECK_SCHEMA }),
    "double-check",
  );
}
