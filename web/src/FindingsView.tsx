/**
 * The findings view.
 *
 * The old view was one flat reverse-chronological list of every finding, which
 * hides the only thing a clinician reads findings *for*: which hypothesis each
 * one moves, and in which direction. This groups findings under the hypothesis
 * they bear on, ordered by probability, so the panel answers "so what?" — with
 * a chronological toggle kept so the case history is still readable as history.
 *
 * A finding bearing on several hypotheses appears under each: it genuinely is
 * evidence for each one, and hiding it under the first would misrepresent the
 * differential.
 */

import { useState } from "react";
import { Cited, SourceChips } from "./Cite.js";
import type { Case, Finding, Hypothesis, Source } from "./types.js";
import { probabilityLabel } from "./probabilityDisplay.js";
import { useEvidenceAttribution } from "./EvidenceAttributionUI.js";

interface Props {
  c: Case;
  onCite?: (index: number) => void;
  /** Focus a hypothesis when its group header is clicked. */
  onSelectHypothesis?: (id: string) => void;
}

type Mode = "grouped" | "timeline";

export function FindingsView({ c, onCite, onSelectHypothesis }: Props) {
  const [mode, setMode] = useState<Mode>("grouped");

  const supports = c.findings.filter((f) => f.direction === "supports").length;
  const against = c.findings.filter((f) => f.direction === "against").length;

  return (
    <>
      <div className="panel-head">
        <h3>Findings</h3>
        <span className="count">{c.findings.length}</span>
        <div className="seg-toggle" role="group" aria-label="Findings view">
          <button
            className={mode === "grouped" ? "on" : ""}
            onClick={() => setMode("grouped")}
            aria-pressed={mode === "grouped"}
          >
            By hypothesis
          </button>
          <button
            className={mode === "timeline" ? "on" : ""}
            onClick={() => setMode("timeline")}
            aria-pressed={mode === "timeline"}
          >
            Timeline
          </button>
        </div>
      </div>

      <div className="findings-summary muted small">
        {c.findings.length === 0
          ? "No findings yet."
          : `${c.findings.length} finding${c.findings.length === 1 ? "" : "s"} · ${supports} support · ${against} against`}
      </div>

      {c.findings.length === 0 ? (
        <p className="muted small">Findings appear as the round runs and as you enter results.</p>
      ) : mode === "grouped" ? (
        <GroupedFindings c={c} onCite={onCite} onSelectHypothesis={onSelectHypothesis} />
      ) : (
        <div className="findings-list">
          {c.findings
            .slice()
            .reverse()
            .map((f) => (
              <FindingRow key={f.id} f={f} sources={c.sources} onCite={onCite} />
            ))}
        </div>
      )}
    </>
  );
}

function GroupedFindings({ c, onCite, onSelectHypothesis }: Props) {
  // Rank groups the way the differential is ranked: what matters most, first.
  const ranked = Object.values(c.hypotheses)
    .filter((h) => h.status !== "branched")
    .sort((a, b) => {
      const rank = (h: Hypothesis) => (h.status === "confirmed" ? 2 : h.status === "live" ? 1 : 0);
      return rank(b) - rank(a) || b.probability - a.probability;
    });

  const groups = ranked
    .map((h) => ({ h, findings: c.findings.filter((f) => f.hypothesisIds.includes(h.id)) }))
    .filter((g) => g.findings.length > 0);

  // Anything the groups above didn't render — unattributed findings, and
  // findings whose only hypothesis has been branched away. A finding must never
  // disappear from the view just because its hypothesis moved.
  const grouped = new Set(groups.flatMap((g) => g.findings.map((f) => f.id)));
  const ungrouped = c.findings.filter((f) => !grouped.has(f.id));

  return (
    <div className="finding-groups">
      {groups.map((g, i) => (
        <FindingGroup
          key={g.h.id}
          title={g.h.name}
          badge={g.h.status === "ruled_out" ? "ruled out" : probabilityLabel(c, g.h)}
          badgeClass={g.h.status}
          findings={g.findings}
          sources={c.sources}
          defaultOpen={i === 0}
          onCite={onCite}
          onTitleClick={() => onSelectHypothesis?.(g.h.id)}
        />
      ))}
      {ungrouped.length > 0 && (
        <FindingGroup
          title="Other findings"
          badge={`${ungrouped.length}`}
          findings={ungrouped}
          sources={c.sources}
          defaultOpen={groups.length === 0}
          onCite={onCite}
        />
      )}
    </div>
  );
}

function FindingGroup({
  title,
  badge,
  badgeClass,
  findings,
  sources,
  defaultOpen,
  onCite,
  onTitleClick,
}: {
  title: string;
  badge: string;
  badgeClass?: string;
  findings: Finding[];
  sources: Source[];
  defaultOpen: boolean;
  onCite?: (index: number) => void;
  onTitleClick?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const forCount = findings.filter((f) => f.direction === "supports").length;
  const againstCount = findings.filter((f) => f.direction === "against").length;

  return (
    <section className={`finding-group${open ? " open" : ""}`}>
      <header className="finding-group-head">
        <button
          className="group-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} findings for ${title}`}
        >
          <span className="caret">{open ? "▾" : "▸"}</span>
          <span
            className="group-title"
            onClick={
              onTitleClick
                ? (e) => {
                    e.stopPropagation();
                    onTitleClick();
                  }
                : undefined
            }
          >
            {title}
          </span>
        </button>
        <span className="group-tally muted small">
          {forCount > 0 && <span className="supports">{forCount} for</span>}
          {forCount > 0 && againstCount > 0 && " · "}
          {againstCount > 0 && <span className="against">{againstCount} against</span>}
        </span>
        <span className={`group-badge ${badgeClass || ""}`}>{badge}</span>
      </header>
      {open && (
        <div className="findings-list">
          {findings.map((f) => (
            <FindingRow key={f.id} f={f} sources={sources} onCite={onCite} />
          ))}
        </div>
      )}
    </section>
  );
}

/** One finding: a single line, expandable to its detail and sources. */
function FindingRow({
  f,
  sources,
  onCite,
}: {
  f: Finding;
  sources: Source[];
  onCite?: (index: number) => void;
}) {
  const attribution = useEvidenceAttribution();
  const [open, setOpen] = useState(false);
  const relation = attribution.relation("finding", f.id);
  const expandable = !!(f.detail || f.citation || f.sourceIndices?.length);

  return (
    <div className={`finding ${f.direction}${open ? " open" : ""}`}
      data-attribution={relation}
      data-finding-id={f.id}
      onPointerEnter={() => attribution.preview({ kind: "finding", id: f.id }, "pointer")}
      onPointerLeave={() => attribution.preview(null, "pointer")}
      onFocus={() => attribution.preview({ kind: "finding", id: f.id }, "keyboard")}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) attribution.preview(null, "keyboard"); }}
      onClick={() => attribution.hold({ kind: "finding", id: f.id })}
    >
      <div className="finding-dir" aria-hidden style={{ color: relation === "against" ? "var(--against)" : relation === "supports" ? "var(--evidence-for-line)" : undefined }}>
        {relation === "mixed" ? "±" : dirIcon(relation === "supports" || relation === "against" || relation === "neutral" ? relation : f.direction)}
      </div>
      <div className="finding-body">
        <div
          className={`finding-summary${expandable ? " expandable" : ""}`}
          onClick={expandable ? () => setOpen((o) => !o) : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          aria-expanded={expandable ? open : undefined}
          onKeyDown={
            expandable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    attribution.hold({ kind: "finding", id: f.id });
                    setOpen((o) => !o);
                  }
                }
              : undefined
          }
        >
          {f.hypothetical && <span className="hypothetical-badge">Hypothetical</span>}
          <Cited text={f.summary} sources={sources} onCite={onCite} />
          <SourceChips ids={f.sourceIndices} sources={sources} onCite={onCite} />
        </div>
        <div className="finding-origin">{f.source === "literature" || f.source === "web" ? "Literature" : f.source === "clinician" ? "Clinician" : f.source}</div>
        {open && (
          <div className="finding-expand">
            {f.detail && (
              <div className="muted small">
                <Cited text={f.detail} sources={sources} onCite={onCite} />
              </div>
            )}
            {f.citation && (
              <a className="cite" href={f.citation.url} target="_blank" rel="noreferrer">
                {f.citation.label}
              </a>
            )}
            <div className="finding-meta">{f.source}</div>
            {f.validationStatus && <div className="muted small">Support check: {f.validationStatus.replaceAll("_", " ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function dirIcon(d: Finding["direction"]): string {
  return d === "supports" ? "↑" : d === "against" ? "↓" : "•";
}
