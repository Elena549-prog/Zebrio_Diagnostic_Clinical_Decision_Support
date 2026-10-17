// Engineering limits, not clinical thresholds. All overridable per call.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface CodingConfig {
  model: string;
  effort: Effort;
  /** Concept searches per provider for one request. */
  maxSearchesPerProvider: number;
  /** Catalogue pages retrieved for one request. */
  maxPages: number;
  /** Claude calls for one request (interpret + select). */
  maxClaudeTurns: number;
  /** Per search/extract/fetch HTTP call. */
  timeoutMs: number;
  /** Per Claude attempt; typical calls take ~4 s, the SDK retries a hung one twice. */
  claudeTimeoutMs: number;
  /** Extra Tavily attempts on a transient error before falling back. */
  tavilyRetries: number;
}

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<CodingConfig> = {}): CodingConfig {
  const effort = (env.CLAUDE_EFFORT ?? "medium") as Effort;
  return {
    model: env.CLAUDE_MODEL || "claude-sonnet-5-5",
    effort: EFFORTS.includes(effort) ? effort : "medium",
    maxSearchesPerProvider: 2,
    maxPages: 3,
    maxClaudeTurns: 4,
    timeoutMs: 20_000,
    claudeTimeoutMs: 45_000,
    tavilyRetries: 1,
    ...overrides,
  };
}
