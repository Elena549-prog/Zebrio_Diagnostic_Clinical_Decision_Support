// The only place that talks to Claude. Plain SDK call with structured JSON output.
import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, LlmRequest } from "./types.js";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export class MalformedOutput extends Error {}

export function anthropicClient(opts: { apiKey?: string; model?: string } = {}): LlmClient {
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 90_000 });
  const model = opts.model || DEFAULT_MODEL;
  return {
    async complete(req: LlmRequest): Promise<string> {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16_000,
        // On a policy decline, let the API retry on its default fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: req.schema } },
      });
      if (res.stop_reason === "refusal") throw new Error(`model declined the ${req.task} request`);
      if (res.stop_reason === "max_tokens") throw new MalformedOutput(`${req.task} output was cut off`);
      return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    },
  };
}

export function parseJson<T>(text: string, task: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MalformedOutput(`${task}: model output was not valid JSON`);
  }
}
