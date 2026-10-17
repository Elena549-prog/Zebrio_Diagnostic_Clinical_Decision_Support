export type ProviderErrorKind =
  | "missing_credentials"
  | "auth"
  | "credits_exhausted"
  | "rate_limit"
  | "timeout"
  | "blocked"
  | "http"
  | "network";

/** Errors after which retrying this provider in the same process is pointless. */
const STICKY: ReadonlySet<ProviderErrorKind> = new Set(["missing_credentials", "auth", "credits_exhausted"]);

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }

  get sticky(): boolean {
    return STICKY.has(this.kind);
  }
}

export function toProviderError(provider: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return new ProviderError(provider, "timeout", "request timed out or was cancelled");
  }
  return new ProviderError(provider, "network", err instanceof Error ? err.message : String(err));
}

export function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
