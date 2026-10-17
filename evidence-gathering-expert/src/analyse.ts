// Steps 1 and 2: ANALYSE (Claude) and QUESTIONS (code). Claude names what to look up; code asks.
import { parseJson } from "./llm.js";
import { ANALYSE_SCHEMA, ANALYSE_SYSTEM } from "./prompts.js";
import type { MinimisedPresentation } from "./privacy.js";
import type { DiagnosisHint, FindingHint, Question } from "./internal.js";
import type { Config, LlmClient } from "./types.js";
import { normalise } from "./verify.js";

interface RawAnalysis {
  presentingProblem: string;
  diagnoses: {
    name: string;
    searchTerm: string;
    findings: { name: string; searchTerm: string; quotedFrom: string; presence: "present" | "absent" }[];
  }[];
}

export interface Analysis {
  presentingProblem: string;
  diagnoses: (DiagnosisHint & { findings: FindingHint[] })[];
  /** Findings dropped because their quote is not in the presentation. */
  rejected: string[];
}

export function presentationText(p: MinimisedPresentation): string {
  return [
    `Chief complaint: ${p.chiefComplaint}`,
    p.history && `History: ${p.history}`,
    p.observations.length && `Observations: ${p.observations.join("; ")}`,
    `Sex: ${p.sex ?? "not stated"}`,
    `Age band: ${p.ageBand ?? "not stated"}`,
    `Country: ${p.country ?? "not stated"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Search terms reach external services, so they are cleaned to a few plain words. */
export function cleanTerm(term: string): string {
  return term
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

// Words that narrow a literature search without naming a concept (age is ranked, not searched).
const NOISE = new Set([
  "absence", "absent", "no", "not", "without", "lack", "of", "acute", "children", "child", "pediatric", "paediatric",
  "adult", "adults", "patients", "patient", "in", "with", "the", "a", "an", "and",
  "diagnosis", "diagnoses", "diagnostic", "differential", "accuracy", "evaluation", "assessment", "suspected",
]);
/** "reflux versus angina chest pain" names two concepts; the search keeps the first. */
const CONTRAST = /\b(versus|vs|or)\b.*$/i;

/**
 * The bare concept for a search: cleaned, no negation, age or method words. With `exclude`
 * (the diagnosis term), diagnosis words the model tacked on are dropped: a trailing run always
 * ("cough pharyngitis" -> "cough"), a leading run only when it ends with the diagnosis' last word
 * ("angina left arm radiation" -> "left arm radiation"), so "chest wall tenderness" keeps "chest".
 */
export function conceptTerm(term: string, exclude = ""): string {
  const words = cleanTerm(term.replace(CONTRAST, ""))
    .toLowerCase()
    .split(" ")
    .filter((w) => w && !NOISE.has(w));
  const dx = exclude ? conceptTerm(exclude).split(" ").filter(Boolean) : [];
  if (!dx.length) return words.join(" ");
  const inDx = new Set(dx);
  let end = words.length;
  while (end > 0 && inDx.has(words[end - 1]!)) end--;
  let start = 0;
  while (start < end && inDx.has(words[start]!)) start++;
  if (start > 0 && words[start - 1] !== dx[dx.length - 1]) start = 0;
  const kept = words.slice(start, end);
  return (kept.length ? kept : words).join(" ");
}

export async function analyse(llm: LlmClient, p: MinimisedPresentation, config: Config): Promise<Analysis> {
  const raw = parseJson<RawAnalysis>(
    await llm.complete({ task: "analyse", system: ANALYSE_SYSTEM, user: presentationText(p), schema: ANALYSE_SCHEMA }),
    "analyse",
  );
  const source = normalise([p.chiefComplaint, p.history, ...p.observations].join(" \n "));
  const rejected: string[] = [];
  let findingSeq = 0;
  const seen = new Map<string, FindingHint>();

  const diagnoses = (raw.diagnoses ?? [])
    .filter((d) => conceptTerm(d.searchTerm || d.name))
    .slice(0, config.maxDiagnoses)
    .map((d, i) => {
      const dxTerm = conceptTerm(d.searchTerm || d.name);
      return {
      id: `h${i + 1}`,
      name: d.name.trim(),
      searchTerm: dxTerm,
      findings: (d.findings ?? [])
        .filter((f) => {
          // The model may only use what the presentation actually says.
          const ok = f.quotedFrom?.trim().length > 0 && source.includes(normalise(f.quotedFrom));
          if (!ok) rejected.push("a suggested finding is not written in the presentation");
          return ok && (conceptTerm(f.searchTerm, dxTerm) || conceptTerm(f.name, dxTerm));
        })
        .slice(0, config.maxFindingsPerDiagnosis)
        .map((f) => {
          const key = `${normalise(f.quotedFrom)}|${f.presence}|${normalise(f.searchTerm || f.name)}`;
          const existing = seen.get(key);
          if (existing) return existing;
          const hint: FindingHint = {
            id: `f${++findingSeq}`,
            name: f.name.trim(),
            searchTerm: conceptTerm(f.searchTerm, dxTerm) || conceptTerm(f.name, dxTerm),
            quotedFrom: f.quotedFrom.trim(),
            presence: f.presence === "absent" ? "absent" : "present",
          };
          seen.set(key, hint);
          return hint;
        }),
      };
    });

  return { presentingProblem: conceptTerm(raw.presentingProblem ?? ""), diagnoses, rejected };
}

export function findingLabel(f: FindingHint): string {
  return f.presence === "absent" ? `absence of ${f.searchTerm}` : f.searchTerm;
}

export function buildQuestions(a: Analysis, ageBand: string | null): Question[] {
  const age = ageBand ? ` aged ${ageBand}` : "";
  const problem = a.presentingProblem || "this presentation";
  const out: Question[] = [];
  for (const d of a.diagnoses) {
    out.push({
      id: `q${out.length + 1}`,
      kind: "prior",
      text: `What is the prevalence of ${d.name} among patients${age} presenting with ${problem}?`,
      diagnosis: d,
      ageBand,
    });
    for (const f of d.findings) {
      out.push({
        id: `q${out.length + 1}`,
        kind: "lr",
        text: `What is the diagnostic accuracy (likelihood ratio, sensitivity, specificity) of ${findingLabel(f)} for ${d.name} in patients${age} with ${problem}?`,
        diagnosis: d,
        finding: f,
        ageBand,
      });
    }
  }
  return out;
}
