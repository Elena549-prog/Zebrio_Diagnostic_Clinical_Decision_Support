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
    .filter((d) => cleanTerm(d.searchTerm ?? d.name))
    .slice(0, config.maxDiagnoses)
    .map((d, i) => ({
      id: `h${i + 1}`,
      name: d.name.trim(),
      searchTerm: cleanTerm(d.searchTerm || d.name),
      findings: (d.findings ?? [])
        .filter((f) => {
          // The model may only use what the presentation actually says.
          const ok = f.quotedFrom?.trim().length > 0 && source.includes(normalise(f.quotedFrom));
          if (!ok) rejected.push("a suggested finding is not written in the presentation");
          return ok && cleanTerm(f.searchTerm || f.name);
        })
        .slice(0, config.maxFindingsPerDiagnosis)
        .map((f) => {
          const key = `${normalise(f.quotedFrom)}|${f.presence}|${normalise(f.searchTerm || f.name)}`;
          const existing = seen.get(key);
          if (existing) return existing;
          const hint: FindingHint = {
            id: `f${++findingSeq}`,
            name: f.name.trim(),
            searchTerm: cleanTerm(f.searchTerm || f.name),
            quotedFrom: f.quotedFrom.trim(),
            presence: f.presence === "absent" ? "absent" : "present",
          };
          seen.set(key, hint);
          return hint;
        }),
    }));

  return { presentingProblem: cleanTerm(raw.presentingProblem ?? ""), diagnoses, rejected };
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
