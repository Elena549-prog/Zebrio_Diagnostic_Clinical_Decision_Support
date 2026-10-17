// Small HTTP wrapper: timeout, one retry, provider health. No patient data ever passes through here.
import type { Provider } from "../types.js";

export class HttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface HttpResponse {
  status: number;
  url: string;
  headers: Headers;
  text: string;
}

export interface HttpOptions {
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  redirect?: "follow" | "manual";
}

const USER_AGENT = "Mozilla/5.0 (compatible; evidence-gathering-expert/0.1; research prototype)";

export class Http {
  /** Every URL requested, in order. Tests use it to prove no patient text leaves the process. */
  readonly log: string[] = [];

  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly timeoutMs: number,
    private readonly retries = 1,
  ) {}

  async request(url: string, opts: HttpOptions = {}): Promise<HttpResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      this.log.push(opts.body ? `${url} ${opts.body}` : url);
      try {
        const res = await this.fetchFn(url, {
          method: opts.method ?? "GET",
          body: opts.body,
          redirect: opts.redirect ?? "follow",
          headers: { "User-Agent": USER_AGENT, ...opts.headers },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        if ((res.status >= 500 || res.status === 429) && attempt < this.retries) {
          lastError = new HttpError(`HTTP ${res.status}`, res.status);
          continue;
        }
        return { status: res.status, url: res.url || url, headers: res.headers, text };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof HttpError ? lastError : new HttpError(`request failed: ${(lastError as Error)?.message ?? lastError}`);
  }

  async get(url: string, opts: HttpOptions = {}): Promise<HttpResponse> {
    return this.request(url, { ...opts, method: "GET" });
  }
}

/** Stops calling a provider after N consecutive failures within one request. */
export class ProviderHealth {
  private failures = new Map<Provider, number>();
  constructor(private readonly maxConsecutive: number) {}

  ok(p: Provider) {
    this.failures.set(p, 0);
  }
  fail(p: Provider) {
    this.failures.set(p, (this.failures.get(p) ?? 0) + 1);
  }
  disabled(p: Provider) {
    return (this.failures.get(p) ?? 0) >= this.maxConsecutive;
  }
}
