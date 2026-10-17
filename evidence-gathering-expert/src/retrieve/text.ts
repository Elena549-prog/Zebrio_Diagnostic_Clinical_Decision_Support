// Turning retrieved XML/HTML into plain text, and picking the passages the checker sees.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function tidy(s: string): string {
  return decodeEntities(s)
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** JATS full-text XML (Europe PMC) → plain text with blank lines between paragraphs. */
export function jatsToText(xml: string): string {
  return tidy(
    xml
      .replace(/<\?xml[^>]*>/g, "")
      .replace(/<(ref-list|back|fn-group|journal-meta|permissions|funding-group|contrib-group|aff)\b[\s\S]*?<\/\1>/g, "")
      // Citation markers would glue numbers onto words ("ARF1"), so drop them entirely.
      .replace(/<sup>\s*<xref[\s\S]*?<\/sup>/g, "")
      .replace(/<xref[^>]*ref-type="bibr"[^>]*>[\s\S]*?<\/xref>/g, "")
      .replace(/<\/(p|title|article-title|td|th|tr|caption|label|list-item)>/g, (m) => (m === "</td>" || m === "</th>" ? " | " : "\n\n"))
      .replace(/<[^>]+>/g, ""),
  );
}

/** Guideline web page HTML → plain text of its readable content. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = tidy(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = tidy(
    main
      .replace(/<(script|style|noscript|nav|header|footer|svg|form|template)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|tr|div|section|article|table|dd|dt)>/gi, "\n\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, ""),
  );
  return { title, text };
}

const NUMERIC_WORDS = /sensitivity|specificity|likelihood ratio|\blr\b|prevalence|incidence|proportion|positive predictive|negative predictive|odds ratio|95% ?ci|confidence interval|%/gi;

/**
 * Pick the paragraphs most likely to answer a question, verbatim, in document order,
 * up to `maxChars`. Every returned passage is an exact substring of `text`.
 */
export function selectPassages(text: string, terms: string[], maxChars: number): string[] {
  const words = terms
    .flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length >= 4);
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 40);
  const scored = paras.map((p, i) => {
    const lower = p.toLowerCase();
    const termHits = words.filter((w) => lower.includes(w)).length;
    const numericHits = (p.match(NUMERIC_WORDS) ?? []).length;
    return { p, i, score: termHits * 2 + Math.min(numericHits, 5) };
  });
  const picked: typeof scored = [];
  let used = 0;
  for (const s of [...scored].filter((s) => s.score > 0).sort((a, b) => b.score - a.score)) {
    const piece = s.p.length > maxChars ? s.p.slice(0, maxChars) : s.p;
    if (used + piece.length > maxChars && picked.length) continue;
    picked.push({ ...s, p: piece });
    used += piece.length;
    if (used >= maxChars) break;
  }
  return picked.sort((a, b) => a.i - b.i).map((s) => s.p);
}
