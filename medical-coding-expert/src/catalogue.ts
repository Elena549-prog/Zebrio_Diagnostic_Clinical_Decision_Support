// Turns a retrieved BfArM catalogue page into discrete entries so that a code
// and its label are only ever verified *within the same entry*.

import type { EntryKind } from "./types.ts";

export interface CatalogueEntry {
  /** Code without trailing "-" marker, e.g. "J45.0". */
  code: string;
  /** Code as printed in the catalogue, e.g. "J45.0-". */
  displayCode: string;
  label: string;
  entryKind: EntryKind;
  /** Inclusion/exclusion/modifier notes belonging to this entry only. */
  notes: string;
  /** Text of this entry only: the passage we cite. */
  passage: string;
}

const CODE_RE = /^[A-Z]\d{2}(?:\.\d{1,2})?$/;

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(dd|dt|div|h\d|li|p|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function kindOf(displayCode: string): EntryKind {
  // "-" marks a heading that needs further digits (subcategories or modifiers).
  return displayCode.endsWith("-") ? "category" : "terminal";
}

/** Structured parse of the official HTML (direct fetch). */
export function parseCatalogueHtml(html: string): CatalogueEntry[] {
  const anchor = /<a name="([^"]+)" id="\1" class="code">([^<]+)<\/a>/g;
  const hits = [...html.matchAll(anchor)];
  const entries: CatalogueEntry[] = [];
  hits.forEach((hit, i) => {
    const code = hit[1]!;
    const displayCode = hit[2]!.trim();
    if (!CODE_RE.test(code)) return;
    const start = hit.index!;
    const end = hits[i + 1]?.index ?? html.length;
    const chunk = html.slice(start, end);
    const labelMatch = chunk.match(/<span class="label">([\s\S]*?)<\/span>/);
    if (!labelMatch) return;
    const label = htmlToText(labelMatch[1]!).replace(/\n/g, " ");
    const afterLabel = chunk.slice(labelMatch.index! + labelMatch[0].length);
    const notes = htmlToText(afterLabel);
    entries.push({
      code,
      displayCode,
      label,
      entryKind: kindOf(displayCode),
      notes,
      passage: [`${displayCode} ${label}`, notes].filter(Boolean).join("\n"),
    });
  });
  return entries;
}

/**
 * Best-effort parse of extracted page text/markdown (Tavily Extract).
 * An entry starts at a line that begins with a code; its label is the rest of
 * that line or the next non-empty line.
 */
export function parseCatalogueText(text: string): CatalogueEntry[] {
  const lines = text
    .split("\n")
    .map((l) =>
      l
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links -> text
        .replace(/^[#>*\-\s|]+/, "") // heading/list/table markers
        .replace(/[*_|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const startRe = /^([A-Z]\d{2}(?:\.\d{1,2})?)(-?)(?:\s+(.*))?$/;
  const starts: number[] = [];
  lines.forEach((line, i) => {
    if (startRe.test(line)) starts.push(i);
  });

  const entries: CatalogueEntry[] = [];
  starts.forEach((s, k) => {
    const m = lines[s]!.match(startRe)!;
    const code = m[1]!;
    const displayCode = code + m[2];
    const end = starts[k + 1] ?? lines.length;
    let label = (m[3] ?? "").trim();
    let noteStart = s + 1;
    if (!label && s + 1 < end) {
      label = lines[s + 1]!;
      noteStart = s + 2;
    }
    if (!label) return;
    const notes = lines.slice(noteStart, end).join("\n");
    entries.push({
      code,
      displayCode,
      label,
      entryKind: kindOf(displayCode),
      notes,
      passage: [`${displayCode} ${label}`, notes].filter(Boolean).join("\n"),
    });
  });
  // Cross-references like "(J46)" inside notes never start a line, so they are
  // not mistaken for entries. Keep the first occurrence of each code.
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.code) ? false : (seen.add(e.code), true)));
}

/** Normalise "j46", "J46 ", "J45.0-" to catalogue form "J46" / "J45.0". */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[-\s]+$/, "");
}
