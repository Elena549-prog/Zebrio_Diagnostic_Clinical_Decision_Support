/**
 * Shared parsing helpers for agent responses.
 *
 * Extracted from engine.ts (treatment.ts had a byte-identical copy) when the
 * evidence pass became a third caller.
 */

/** Extract the first parseable JSON object from an LLM text blob. */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  // Strip markdown code fences if present.
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    // fall through to brace scan
  }
  // Find the first balanced { ... } object.
  const start = t.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = t.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Model prose may link only to artifacts already in the retrieved source pool. */
export function groundLinks(text: string | undefined, sources: { url?: string }[]): string | undefined {
  if (text === undefined) return undefined;
  const allowed = new Set(sources.flatMap((source) => source.url ? [source.url] : []));
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_all, label: string, url: string) => allowed.has(url) ? `[${label}](${url})` : `${label} (unverified link omitted)`)
    .replace(/https?:\/\/[^\s<>"\])]+/g, (url) => allowed.has(url) ? url : '(unverified link omitted)');
}
