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

export interface AssignDeps extends RetrievalDeps {
  model: CodingModel;
  config: CodingConfig;
}

export interface AssignOptions {
  signal?: AbortSignal;
  deps?: Partial<AssignDeps>;
}

export const BASE_LIMITATIONS = [
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

/** Entries sent to Claude for selection; a chapter page can hold hundreds. */
const MAX_ENTRIES_FOR_SELECTION = 150;

/**
 * Web queries get generic catalogue wording only. Long digit runs (dates, ids)
 * are dropped, and terms that copy record text fall back to the condition name.
 */
export function safeSearchTerms(c: InterpretedCondition, request: CodingRequest): string {
  const normalize = (t: string) =>
    t
      .replace(/[^\p{L}\p{N}.\-\s]/gu, " ")
      .replace(/\b\d{3,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const clean = (t: string) => normalize(t).slice(0, 80);
  const terms = clean(c.searchTerms);
  const words = terms.toLowerCase().split(" ");
  const record = [...request.excerpts, ...request.evidence].map((x) => normalize(x.text).toLowerCase());
  const copiesRecord = words.some((_, i) => i + 5 <= words.length && record.some((r) => r.includes(words.slice(i, i + 5).join(" "))));
  return copiesRecord || !terms ? clean(c.condition) : terms;
}

/** Model output may only point at IDs that exist in the request. */
function keepKnownIds(conditions: InterpretedCondition[], request: CodingRequest): InterpretedCondition[] {
  const inputIds = new Set([...request.excerpts, ...request.evidence].map((x) => x.id));
  const hypothesisIds = new Set((request.hypotheses ?? []).map((h) => h.id));
  return conditions.map((c) => ({
    ...c,
    inputRefs: c.inputRefs.filter((id) => inputIds.has(id)),
    hypothesisId: c.hypothesisId && hypothesisIds.has(c.hypothesisId) ? c.hypothesisId : null,
  }));
}

function resolveDeps(injected: Partial<AssignDeps> = {}): AssignDeps {
  const base = defaultDeps();
  const config = injected.config ?? base.config;
  // An injected config must also reach the default Claude model.
  const model = injected.model ?? (injected.config ? createClaudeModel(config) : base.model);
  return { ...base, ...injected, config, model };
}

export async function assignMedicalCodes(request: CodingRequest, options: AssignOptions = {}): Promise<CodingResponse> {
  const deps = resolveDeps(options.deps);
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
  const unavailable = (c: InterpretedCondition, rationale: string): CodingResult => ({ ...baseResult(c), status: "unavailable", rationale });

  // 1. Interpret the documentation.
  let conditions: InterpretedCondition[];
  try {
    turns++;
    const out = await deps.model.interpret(request, signal);
    fallbackNote(out.servedByFallback);
    conditions = keepKnownIds(out.conditions, request);
  } catch (err) {
    if (!(err instanceof ModelUnavailableError)) throw err;
    limitations.push(`Claude unavailable: ${err.message}`);
    response.results = (request.hypotheses ?? []).map((h) =>
      unavailable(
        { condition: h.name, hypothesisId: h.id, assertion: "suspected", inputRefs: [], documentedSpecifics: "", searchTerms: "" },
        "The documentation could not be interpreted, so nothing was coded.",
      ),
    );
    return response;
  }

  // 2. Conditions that must not be coded are settled without retrieval.
  const results: (CodingResult | null)[] = conditions.map((c) => {
    const reason = NOT_CODED[c.assertion];
    return reason ? { ...baseResult(c), status: "no_supported_code", rationale: reason } : null;
  });
  const pendingConditions = conditions
    .map((c, i) => ({ c, i, terms: safeSearchTerms(c, request) }))
    .filter(({ i }) => results[i] === null);

  if (pendingConditions.length) {
    // 3. Retrieve official pages (bounded across the whole request).
    const retrieval = await retrieveCatalogue([...new Set(pendingConditions.map((p) => p.terms))], deps, deps.config, signal);
    response.searchProvidersUsed = retrieval.searchProvidersUsed;
    limitations.push(...retrieval.notes);

    const toCode = pendingConditions.filter(({ c, i, terms }) => {
      if (retrieval.searchedTerms.includes(terms)) return true;
      results[i] = unavailable(c, `Not searched: the per-request budget of ${deps.config.maxSearchesPerProvider} concept searches was used up.`);
      return false;
    });
    const index = indexEntries(retrieval.pages);

    if (toCode.length && !index.size) {
      for (const { c, i } of toCode) {
        results[i] = unavailable(c, "No official BfArM ICD-10-GM 2026 entry could be retrieved, so no code is suggested.");
      }
    } else if (toCode.length && turns >= deps.config.maxClaudeTurns) {
      limitations.push("Claude turn budget exhausted before code selection.");
    } else if (toCode.length) {
      // 4. Claude selects among retrieved entries; code verifies.
      const entries = [...index.values()].map((v) => v.entry);
      if (entries.length > MAX_ENTRIES_FOR_SELECTION) {
        limitations.push(`Only the first ${MAX_ENTRIES_FOR_SELECTION} of ${entries.length} retrieved entries were offered for selection.`);
      }
      try {
        turns++;
        const out = await deps.model.select(
          { conditions: toCode.map(({ c }) => c), entries: entries.slice(0, MAX_ENTRIES_FOR_SELECTION) },
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
    for (const { c, i } of toCode) results[i] ??= unavailable(c, "Code selection did not complete.");
  }

  response.results = results as CodingResult[];
  return response;
}
