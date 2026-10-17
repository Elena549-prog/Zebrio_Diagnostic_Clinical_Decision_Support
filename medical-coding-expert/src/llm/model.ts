// The seam between coding logic and the language model. Tests inject a fake;
// production uses Claude (claude.ts). Everything the model returns is treated
// as a proposal and verified in code against retrieved catalogue entries.

import { z } from "zod";
import type { CatalogueEntry } from "../catalogue.ts";
import type { CodingRequest } from "../types.ts";

export const InterpretedConditionSchema = z.object({
  condition: z.string().describe("Short name of the condition as documented"),
  hypothesisId: z.string().nullable().describe("Matching hypothesis id, or null"),
  assertion: z.enum(["documented", "suspected", "negated", "historical", "family_history", "literature_only"]),
  inputRefs: z.array(z.string()).describe("Excerpt/evidence ids that mention this condition"),
  documentedSpecifics: z
    .string()
    .describe("Only details that are explicitly documented and matter for specificity (type, severity, control status, laterality, cause). Empty if none."),
  searchTerms: z
    .string()
    .describe("German ICD-10-GM catalogue wording for the condition, optionally with a likely code. No patient details."),
});
export type InterpretedCondition = z.infer<typeof InterpretedConditionSchema>;

export const InterpretationSchema = z.object({ conditions: z.array(InterpretedConditionSchema) });

export const SelectionSchema = z.object({
  conditionIndex: z.number().int(),
  decision: z.enum(["assigned", "needs_clarification", "no_supported_code"]),
  code: z.string().nullable().describe("Exactly one code from the supplied entries, or null"),
  candidateCodes: z.array(z.string()).describe("Other supplied codes worth considering"),
  rationale: z.string().describe("1-3 sentences citing input ids and the entry wording"),
  clarificationQuestions: z.array(z.string()),
});
export type Selection = z.infer<typeof SelectionSchema>;

export const SelectionsSchema = z.object({ selections: z.array(SelectionSchema) });

export interface SelectionInput {
  conditions: InterpretedCondition[];
  entries: CatalogueEntry[];
}

export interface ModelCallMeta {
  /** Set when the server-side refusal fallback answered instead of the configured model. */
  servedByFallback?: string;
}

export interface CodingModel {
  interpret(request: CodingRequest, signal?: AbortSignal): Promise<{ conditions: InterpretedCondition[] } & ModelCallMeta>;
  select(input: SelectionInput, signal?: AbortSignal): Promise<{ selections: Selection[] } & ModelCallMeta>;
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelUnavailableError";
  }
}
