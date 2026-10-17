/**
 * Inline citations.
 *
 * `<Cited>` renders prose that carries `[3]` / `[1, 4]` markers, turning each
 * into a superscript chip that links to the source and, on hover, names it. The
 * server guarantees a rendered marker resolves (unresolvable ones are stripped
 * before the wire — see docs/adr/0003-grounded-inline-citations.md), so this
 * component treats a missing pool entry as a bug it should not paper over: it
 * renders the marker as plain text rather than a dead link.
 *
 * `<SourceList>` is the bibliography those chips point into.
 */

import type { Source } from "./types.js";

/** Matches a rendered marker: [3] or [1, 4]. */
const MARKER = /\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g;

interface CitedProps {
  text?: string;
  sources: Source[];
  /** Optional: called with a source index when a chip is clicked. */
  onCite?: (index: number) => void;
}

/** Prose with its inline citation markers rendered as source chips.
 *  `sources` defaults to `[]` so a case carrying no pool renders plain text
 *  instead of throwing on `sources.map`. */
export function Cited({ text, sources = [], onCite }: CitedProps) {
  if (!text) return null;
  const byIndex = new Map(sources.map((s) => [s.index, s]));

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of text.matchAll(MARKER)) {
    const at = m.index ?? 0;
    if (at > cursor) nodes.push(text.slice(cursor, at));
    const indices = m[1]!
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n));
    const known = indices.filter((i) => byIndex.has(i));
    if (known.length === 0) {
      // No pool entry: show the literal text rather than a chip to nowhere.
      nodes.push(m[0]);
    } else {
      nodes.push(
        <sup className="cite-group" key={`c${key++}`}>
          {known.map((i, n) => {
            const s = byIndex.get(i)!;
            return (
              <span key={i}>
                {n > 0 && <span className="cite-sep">,</span>}
                <CiteChip source={s} onCite={onCite} />
              </span>
            );
          })}
        </sup>,
      );
    }
    cursor = at + m[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function CiteChip({ source, onCite }: { source: Source; onCite?: (index: number) => void }) {
  const title = `${source.title}${source.identifier ? ` (${source.identifier})` : ""}${
    source.note ? `\n${source.note}` : ""
  }`;
  const common = {
    className: "cite-chip",
    title,
    onClick: () => onCite?.(source.index),
  };
  return source.url ? (
    <a {...common} href={source.url} target="_blank" rel="noreferrer">
      {source.index}
    </a>
  ) : (
    <button {...common} type="button">
      {source.index}
    </button>
  );
}

/** Chips for a finding's backing sources, shown where prose has no markers. */
export function SourceChips({
  ids,
  sources,
  onCite,
}: {
  ids?: number[];
  sources: Source[];
  onCite?: (index: number) => void;
}) {
  if (!ids?.length) return null;
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  const known = ids.map((i) => byIndex.get(i)).filter((s): s is Source => !!s);
  if (!known.length) return null;
  return (
    <span className="cite-group">
      {known.map((s) => (
        <CiteChip key={s.index} source={s} onCite={onCite} />
      ))}
    </span>
  );
}

/** The case bibliography — every Source the reasoning has actually cited. */
export function SourceList({
  sources,
  highlight,
}: {
  sources: Source[];
  highlight?: number | null;
}) {
  if (!sources.length) return null;
  return (
    <ol className="source-list">
      {sources.map((s) => (
        <li
          key={s.index}
          id={`source-${s.index}`}
          className={`source-item${highlight === s.index ? " highlight" : ""}`}
        >
          <span className="source-index">{s.index}</span>
          <div>
            {s.url ? (
              <a className="source-title" href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              <span className="source-title">{s.title}</span>
            )}
            <div className="source-meta muted small">
              {[s.type, s.identifier, `round ${s.addedRound}`].filter(Boolean).join(" · ")}
            </div>
            {s.note && <div className="muted small">{s.note}</div>}
            <div className="muted small">Support check: {s.validationStatus?.replaceAll("_", " ") ?? "not independently validated"}</div>
            {s.excerpt && <blockquote className="source-excerpt">{s.excerpt}</blockquote>}
            {s.retrievedAt && <div className="muted small">Retrieved {new Date(s.retrievedAt).toLocaleString()}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
