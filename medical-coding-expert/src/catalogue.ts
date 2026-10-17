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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" stays "&lt;"
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

function makeEntry(code: string, displayCode: string, label: string, notes: string): CatalogueEntry {
  return {
    code,
    displayCode,
    label,
    entryKind: kindOf(displayCode),
    notes,
    passage: [`${displayCode} ${label}`, notes].filter(Boolean).join("\n"),
  };
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
    entries.push(makeEntry(code, displayCode, label, htmlToText(afterLabel)));
  });
  return entries;
}

/**
 * Parse Tavily Extract markdown. Entries are markdown headings such as
 * "#### J46 Status asthmaticus" or "##### J45.0- Vorwiegend allergisches ...".
 * Only headings start an entry, so cross-references in notes and bullet lists
 * ("([J46](#J46))") can never be mistaken for one.
 */
export function parseCatalogueText(markdown: string): CatalogueEntry[] {
  const lines = markdown.split("\n");
  const heading = /^#{3,6}\s+([A-Z]\d{2}(?:\.\d{1,2})?)(\.?-)?\s+(.+?)\s*$/;
  const starts: { i: number; m: RegExpMatchArray }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(heading);
    if (m) starts.push({ i, m });
  });
  const seen = new Set<string>();
  const entries: CatalogueEntry[] = [];
  starts.forEach(({ i, m }, k) => {
    const code = m[1]!;
    if (seen.has(code)) return;
    seen.add(code);
    const end = starts[k + 1]?.i ?? lines.length;
    const notes = lines
      .slice(i + 1, end)
      .map((l) => l.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^[\s:*>-]+/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    entries.push(makeEntry(code, code + (m[2] ?? ""), m[3]!.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"), notes));
  });
  return entries;
}

/** Normalise "j46", "J46 ", "J45.0-" to catalogue form "J46" / "J45.0". */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[-.\s]+$/, "");
}
