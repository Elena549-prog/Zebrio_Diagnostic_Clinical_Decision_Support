import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** A fetch that serves canned responses by URL pattern and fails loudly on anything else. */
export function fakeFetch(routes: [RegExp, Handler][]): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(init?.body ? `${url} ${String(init.body)}` : url);
    const route = routes.find(([re]) => re.test(url));
    if (!route) return new Response(`no fixture for ${url}`, { status: 404 });
    return route[1](url, init);
  }) as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
export const xml = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "application/xml" } });
export const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
