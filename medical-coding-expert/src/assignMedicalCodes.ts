// Person 2 entry point: clinical excerpts in, source-checked ICD-10-GM 2026
// suggestions out. Claude proposes; this file verifies against retrieved
// official entries and owns every status decision.

import { normalizeCode, type CatalogueEntry } from "./catalogue.ts";
import { loadConfig, type CodingConfig } from "./config.ts";
import { createClaudeModel } from "./llm/claude.ts";
import { ModelUnavailableError, type CodingModel, type InterpretedCondition, type Selection } from "./llm/model.ts";
import { createDirectFetcher } from "./retrieval/directFetch.ts";
import { createDuckDuckGo } from "./retrieval/duckduckgo.ts";
import { processProviderState, retrieveCatalogue, type RetrievalDeps, type RetrievedPage } from "./retrieval/retrieve.ts";
import { createTavily } from "./retrieval/tavily.ts";
import type { Candidate, CodingRequest, CodingResponse, CodingResult, Reference } from "./types.ts";
import { CATALOGUE_HOST } from "./urlPolicy.ts";

export interface AssignDeps extends RetrievalDeps {
  model: CodingModel;
  config: CodingConfig;
}

export interface AssignOptions {
  signal?: AbortSignal;
  deps?: Partial<AssignDeps>;
}

const BASE_LIMITATIONS = [
  "Suggestions are source-checked against the BfArM ICD-10-GM 2026 catalogue; they do not confirm a diagnosis or certify billing compliance.",
  "German coding rules (Kodierrichtlinien), sequencing and secondary-diagnosis rules are not checked.",
  "Codes that need a 5th-digit modifier are returned as needs_clarification; combined modifier codes are not assembled.",
];

export function defaultDeps(env: NodeJS.ProcessEnv = process.env): AssignDeps {
  const config = loadConfig(env);
  return {
    config,
    model: createClaudeModel(config),
    tavily: createTavily(env.TAVILY_API_KEY),
    duckduckgo: createDuckDuckGo(),
    directFetch: createDirectFetcher(),
    state: processProviderState,
    now: () => new Date(),
  };
}

interface VerifiedEntry {
  entry: CatalogueEntry;
  page: RetrievedPage;
}

function indexEntries(pages: RetrievedPage[]): Map<string, VerifiedEntry> {
  const index = new Map<string, VerifiedEntry>();
  for (const page of pages) {
    for (const entry of page.entries) {
      if (!index.has(entry.code)) index.set(entry.code, { entry, page });
    }
  }
  return index;
}

function referenceFor({ entry, page }: VerifiedEntry): Reference {
  return {
    url: `${page.url}#${entry.code}`,
    supportingPassage: entry.passage.slice(0, 1200),
    retrievedAt: page.retrievedAt,
    retrievalProvider: page.provider,
  };
}

function candidateFor(v: VerifiedEntry): Candidate {
  return { code: v.entry.displayCode, officialLabel: v.entry.label, entryKind: v.entry.entryKind, reference: referenceFor(v) };
}

function baseResult(c: InterpretedCondition): Omit<CodingResult, "status" | "rationale"> {
  return {
    condition: c.condition,
    ...(c.hypothesisId ? { hypothesisId: c.hypothesisId } : {}),
    assertion: c.assertion,
    code: null,
    officialLabel: null,
    inputRefs: c.inputRefs,
    references: [],
    clarificationQuestions: [],
  };
}

const NOT_CODED: Partial<Record<InterpretedCondition["assertion"], string>> = {
  negated: "Documented as absent or ruled out, so no code is suggested.",
  family_history: "Mentioned only as family history, not as a condition of this patient.",
  literature_only: "Appears only in literature evidence, which is not evidence that this patient has it.",
  historical: "Documented as a past condition; history codes (Z86/Z87) are out of scope for this version.",
};

/** Turns a model selection into a result, trusting only retrieved entries. */
export function verifySelection(
  condition: InterpretedCondition,
  selection: Selection | undefined,
  index: Map<string, VerifiedEntry>,
): CodingResult {
  const base = baseResult(condition);
  if (!selection) {
    return { ...base, status: "unavailable", rationale: "No coding decision was returned for this condition." };
  }

  const candidates: Candidate[] = [];
  const rejected: string[] = [];
  const consider = (raw: string) => {
    const v = index.get(normalizeCode(raw));
    if (!v) return void rejected.push(raw);
    if (!candidates.some((c) => c.code === v.entry.displayCode)) candidates.push(candidateFor(v));
  };
  selection.candidateCodes.forEach(consider);
  const chosen = selection.code ? index.get(normalizeCode(selection.code)) : undefined;
  if (selection.code && !chosen) rejected.push(selection.code);

  const rejectionNote = rejected.length
    ? ` Rejected ${rejected.join(", ")}: not found as an entry on a retrieved official 2026 page.`
    : "";
  const questions = selection.clarificationQuestions;
  const withCandidates = (extra: Candidate[] = []) => {
    const all = [...extra, ...candidates.filter((c) => !extra.some((e) => e.code === c.code))];
    return all.length ? { candidates: all } : {};
  };

  if (condition.assertion !== "documented") {
    return {
      ...base,
      status: "needs_clarification",
      rationale: `${selection.rationale} Mentioned as ${condition.assertion}, so no code is assigned until it is confirmed.${rejectionNote}`.trim(),
      clarificationQuestions: questions.length ? questions : [`Is "${condition.condition}" a confirmed diagnosis for this patient?`],
      ...withCandidates(chosen ? [candidateFor(chosen)] : []),
    };
  }

  if (selection.decision === "assigned" && chosen?.entry.entryKind === "terminal") {
    return {
      ...base,
      status: "assigned",
      code: chosen.entry.displayCode,
      officialLabel: chosen.entry.label,
      rationale: selection.rationale + rejectionNote,
      references: [referenceFor(chosen)],
      clarificationQuestions: questions,
      ...withCandidates(),
    };
  }

  if (chosen && chosen.entry.entryKind !== "terminal") {
    return {
      ...base,
      status: "needs_clarification",
      rationale: `${selection.rationale} ${chosen.entry.displayCode} is a heading that needs further digits.${rejectionNote}`.trim(),
      references: [referenceFor(chosen)],
      clarificationQuestions: questions.length
        ? questions
        : [`Which further specification of "${chosen.entry.label}" is documented?`],
      ...withCandidates([candidateFor(chosen)]),
    };
  }

  if (selection.decision === "needs_clarification" && (candidates.length || chosen)) {
    return {
      ...base,
      status: "needs_clarification",
      rationale: selection.rationale + rejectionNote,
      clarificationQuestions: questions,
      ...withCandidates(chosen ? [candidateFor(chosen)] : []),
    };
  }

  return {
    ...base,
    status: "no_supported_code",
    rationale: `${selection.rationale}${rejectionNote}`.trim(),
    clarificationQuestions: questions,
    ...withCandidates(),
  };
}

function searchQuery(c: InterpretedCondition): string {
  const terms = c.searchTerms.replace(/[^\p{L}\p{N}.\-\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  // DuckDuckGo ignores site: filters with a path; the edition goes in as a term.
  return `site:${CATALOGUE_HOST} htmlgm2026 ${terms}`;
}

export async function assignMedicalCodes(request: CodingRequest, options: AssignOptions = {}): Promise<CodingResponse> {
  const deps: AssignDeps = { ...defaultDeps(), ...options.deps } as AssignDeps;
  const { signal } = options;
  const limitations = [...BASE_LIMITATIONS];
  const response: CodingResponse = {
    requestId: request.requestId,
    system: "ICD-10-GM",
    edition: "2026",
    results: [],
    searchProvidersUsed: [],
    limitations,
  };
  let turns = 0;
  const fallbackNote = (servedBy?: string) => {
    if (servedBy) limitations.push(`A Claude refusal was handled by the server-side fallback model ${servedBy}.`);
  };

  // 1. Interpret the documentation.
  let conditions: InterpretedCondition[];
  try {
    turns++;
    const out = await deps.model.interpret(request, signal);
    fallbackNote(out.servedByFallback);
    conditions = out.conditions;
  } catch (err) {
    if (!(err instanceof ModelUnavailableError)) throw err;
    limitations.push(`Claude unavailable: ${err.message}`);
    response.results = (request.hypotheses ?? []).map((h) => ({
      condition: h.name,
      hypothesisId: h.id,
      assertion: "suspected",
      status: "unavailable",
      code: null,
      officialLabel: null,
      rationale: "The documentation could not be interpreted, so nothing was coded.",
      inputRefs: [],
      references: [],
      clarificationQuestions: [],
    }));
    return response;
  }

  // 2. Conditions that must not be coded are settled without retrieval.
  const results: (CodingResult | null)[] = conditions.map((c) => {
    const reason = NOT_CODED[c.assertion];
    return reason ? { ...baseResult(c), status: "no_supported_code", rationale: reason } : null;
  });
  const toCode = conditions.map((c, i) => ({ c, i })).filter(({ i }) => results[i] === null);

  if (toCode.length) {
    // 3. Retrieve official pages (bounded across the whole request).
    const queries = [...new Set(toCode.map(({ c }) => searchQuery(c)))];
    const retrieval = await retrieveCatalogue(queries, deps, deps.config, signal);
    response.searchProvidersUsed = retrieval.searchProvidersUsed;
    limitations.push(...retrieval.notes);
    if (queries.length > deps.config.maxSearchesPerProvider) {
      limitations.push(`Only the first ${deps.config.maxSearchesPerProvider} conditions were searched (search budget).`);
    }
    const index = indexEntries(retrieval.pages);

    if (!index.size) {
      for (const { c, i } of toCode) {
        results[i] = {
          ...baseResult(c),
          status: "unavailable",
          rationale: "No official BfArM ICD-10-GM 2026 entry could be retrieved, so no code is suggested.",
        };
      }
    } else if (turns >= deps.config.maxClaudeTurns) {
      limitations.push("Claude turn budget exhausted before code selection.");
    } else {
      // 4. Claude selects among retrieved entries; code verifies.
      try {
        turns++;
        const out = await deps.model.select(
          { conditions: toCode.map(({ c }) => c), entries: [...index.values()].map((v) => v.entry) },
          signal,
        );
        fallbackNote(out.servedByFallback);
        toCode.forEach(({ c, i }, k) => {
          results[i] = verifySelection(c, out.selections.find((s) => s.conditionIndex === k), index);
        });
      } catch (err) {
        if (!(err instanceof ModelUnavailableError)) throw err;
        limitations.push(`Claude unavailable during code selection: ${err.message}`);
      }
    }
    for (const { c, i } of toCode) {
      results[i] ??= { ...baseResult(c), status: "unavailable", rationale: "Code selection did not complete." };
    }
  }

  response.results = results as CodingResult[];
  return response;
}
