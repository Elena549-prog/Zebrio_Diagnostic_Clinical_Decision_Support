/**
 * EvidencePanel (left) — the case record: the presentation summary, the
 * findings so far, and the proposed tests.
 *
 * The "add finding / test result" form used to live here; it has moved to
 * NextAction, co-located with the HITL gate that asks for it. This panel now
 * shows the accumulated evidence so the clinician can read the case at a
 * glance — the content the user liked, kept.
 *
 * The flat findings list has been replaced by FindingsView (grouped by the
 * hypothesis each finding moves), and the case bibliography now sits at the
 * foot of the panel as the target of every inline citation chip.
 */

import { useState } from "react";
import { Cited, SourceList } from "./Cite.js";
import { FindingsView } from "./FindingsView.js";
import type { Case, Hypothesis } from "./types.js";

interface Props {
  c: Case;
  onSelectHypothesis?: (id: string) => void;
}

export function EvidencePanel({ c, onSelectHypothesis }: Props) {
  // Which bibliography entry to flash when a citation chip is clicked.
  const [highlight, setHighlight] = useState<number | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  function focusSource(index: number) {
    setSourcesOpen(true);
    setHighlight(index);
    // Let the list mount before scrolling to the entry.
    requestAnimationFrame(() => {
      document.getElementById(`source-${index}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    window.setTimeout(() => setHighlight((h) => (h === index ? null : h)), 2000);
  }

  return (
    <div className="evidence-panel">
      <div className="panel-head">
        <h3>Presentation</h3>
      </div>
      <div className="presentation-card">
        <div className="cc">{c.presentation.chiefComplaint}</div>
        {c.presentation.history && <p className="muted small">{c.presentation.history}</p>}
        <div className="demo">
          {[
            c.presentation.demographics.ageYears != null && `age ${c.presentation.demographics.ageYears}`,
            c.presentation.demographics.sex,
            c.presentation.demographics.raceEthnicity,
            c.presentation.demographics.location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {c.presentation.observations?.length ? (
          <ul className="obs">
            {c.presentation.observations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <FindingsView c={c} onCite={focusSource} onSelectHypothesis={onSelectHypothesis} />

      {c.tests.length > 0 && (
        <>
          <div className="panel-head">
            <h3>Proposed tests</h3>
          </div>
          <div className="tests-list">
            {c.tests.map((t) => (
              // The badge is a flex sibling of the text column, not an
              // absolutely-positioned overlay — a long test name now wraps
              // beside it instead of running underneath it.
              <div key={t.id} className={`test ${t.status}`}>
                <div className="test-main">
                  <div className="test-name">{t.name}</div>
                  <div className="muted small">
                    <Cited text={t.rationale} sources={c.sources} onCite={focusSource} />
                  </div>
                </div>
                <span className={`test-status ${t.status}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {c.sources.length > 0 && (
        <>
          <div className="panel-head">
            <button
              className="group-toggle"
              onClick={() => setSourcesOpen((o) => !o)}
              aria-expanded={sourcesOpen}
            >
              <span className="caret">{sourcesOpen ? "▾" : "▸"}</span>
              <h3>Sources</h3>
            </button>
            <span className="count">{c.sources.length}</span>
          </div>
          {sourcesOpen ? (
            <SourceList sources={c.sources} highlight={highlight} />
          ) : (
            <p className="muted small">
              {c.sources.length} source{c.sources.length === 1 ? "" : "s"} gathered by the evidence
              pass. Every numbered marker above points here.
            </p>
          )}
        </>
      )}
    </div>
  );
}
