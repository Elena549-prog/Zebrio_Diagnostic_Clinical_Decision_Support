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

/** Minimum gap between requests to hosts with published rate limits (NCBI: 3/s without a key). */
const MIN_SPACING_MS: Record<string, number> = { "eutils.ncbi.nlm.nih.gov": 350 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(res: Response): number {
  const s = Number(res.headers.get("retry-after"));
  return Number.isFinite(s) && s >= 0 ? Math.min(s * 1000, 5000) : 1000;
}

export class Http {
  /** Every URL requested, in order. Tests use it to prove no patient text leaves the process. */
  readonly log: string[] = [];
  private nextSlot = new Map<string, number>();

  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly timeoutMs: number,
    private readonly retries = 1,
  ) {}

  /** Reserve the next free time slot for a rate-limited host and wait for it. */
  private async throttle(url: string) {
    const host = new URL(url).hostname;
    const gap = MIN_SPACING_MS[host];
    if (!gap) return;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + gap);
    if (slot > now) await sleep(slot - now);
  }

  async request(url: string, opts: HttpOptions = {}): Promise<HttpResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await this.throttle(url);
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
          if (res.status === 429) await sleep(retryAfterMs(res));
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
  /** A block or challenge means stop for the rest of this request; never retry around it. */
  block(p: Provider) {
    this.failures.set(p, Infinity);
  }
  disabled(p: Provider) {
    return (this.failures.get(p) ?? 0) >= this.maxConsecutive;
  }
}
