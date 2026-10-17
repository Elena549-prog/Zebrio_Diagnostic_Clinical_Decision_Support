/**
 * DetailPanel (right) — drill into one hypothesis (evidence trail, codes,
 * base-rate, discriminating tests) and show the verdict + treatment plan.
 *
 * Every claim-bearing surface here renders through <Cited>, so the base-rate
 * prior, the illness script, and each step of the reasoning trail carry the
 * markers of the sources behind them. A step with no markers has no grounded
 * source — which is information, not an omission.
 */

import { useState } from "react";
import { Cited, SourceChips } from "./Cite.js";
import type { Case, Finding, Hypothesis } from "./types.js";
import * as api from "./api.js";
import { probabilityLabel, probabilityMode } from "./probabilityDisplay.js";
import { RarityReference, rarityLabel } from './RarityReference.js';

/** Long descriptions are clamped to a few lines with a "show more" toggle so
 *  the panel stays scannable; the full text is one click away. */
const DESC_CLAMP_LINES = 3;

interface Props {
  c: Case;
  selectedId: string | null;
  onUpdated: (c: Case) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  /**
   * Whether to show the live API actions (the "Set working dx" convergence
   * button). Defaults true for the live workspace; the Tutorial passes false
   * because the canned case has no backing API call — that button would error.
   * Read-only detail (the bulk of the panel) is always shown.
   */
  interactive?: boolean;
}

export function DetailPanel({ c, selectedId, onUpdated, busy, setBusy, interactive = true }: Props) {
  const h: Hypothesis | undefined = selectedId ? c.hypotheses[selectedId] : undefined;
  const ordinalIndex = Object.values(c.hypotheses)
    .filter((candidate) => candidate.status === 'live' || candidate.status === 'branched')
    .sort((a, b) => b.probability - a.probability)
    .findIndex((candidate) => candidate.id === h?.id);
  const findingsById: Record<string, Finding> = {};
  for (const f of c.findings) findingsById[f.id] = f;
  const [descOpen, setDescOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Last line of defence for the codes row. The server normalizes what the
  // model returns, but canned/persisted cases and any future writer reach this
  // component too — and an entry without a system+code used to render as a
  // bare ":" row. Drop those here so they can never reach the DOM.
  const codes = (h?.codes ?? []).filter((x) => x && x.system && x.code);

  // Discoverability for "Set working dx": when reasoning and there is a leading
  // live hypothesis, surface the action where the user is looking at it. This
  // was a buried ghost button in the chat actions; now it explains *when*.
  const topLive = Object.values(c.hypotheses)
    .filter((x) => x.status === "live")
    .sort((a, b) => b.probability - a.probability)[0];
  const pendingCandidate = c.pendingDiagnosis ? c.hypotheses[c.pendingDiagnosis.hypothesisId] : undefined;
  const selectedCandidate = h?.status === "live" ? h : pendingCandidate ?? topLive;
  const canConverge = (c.status === "reasoning" || c.status === "converged") && !!selectedCandidate && !c.workingDiagnosis;

  async function setWorkingDx() {
    if (busy || !selectedCandidate) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.diagnose(c.id, { hypothesisId: selectedCandidate.id });
      onUpdated(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-panel">
      {interactive && canConverge && (
        <div className="converge-hint">
          <div className="converge-hint-text">
            <strong>{c.pendingDiagnosis ? "Proposed working diagnosis" : "Review the working diagnosis"}</strong>
            <p className="muted small">
              {h?.status === "live" ? "Selected hypothesis" : "Leading hypothesis"}: <em>{selectedCandidate!.name}</em> ({probabilityLabel(c, selectedCandidate!)}). Review the evidence before confirming.
            </p>
          </div>
          <button onClick={setWorkingDx} disabled={busy}>
            Confirm working dx
          </button>
        </div>
      )}
      {error && <div className="na-err" role="alert">{error}</div>}
      {c.workingDiagnosis && (
        <div className="verdict-card">
          <h3>Working diagnosis</h3>
          <div className="dx-name">{c.workingDiagnosis.name}</div>
          <div className="dx-conf">{probabilityMode(c) === "illustrative" && c.workingDiagnosis.confidence != null
            ? `Illustrative confidence ${Math.round(c.workingDiagnosis.confidence * 100)}%`
            : "Confirmed by clinician · numerical confidence unavailable"}</div>
          <div className="trail">
            <strong>Reasoning trail</strong>
            <ol>
              {c.workingDiagnosis.reasoningTrail.map((t, i) => (
                <li key={i}>
                  <Cited text={t} sources={c.sources} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {c.treatmentPlan && (
        <div className="treatment-card">
          <h3>Treatment plan</h3>
          {/* Treatment prose is NOT marker-rewritten (treatment.ts has no
              source pool), so it renders plain: a bracketed number there means
              nothing, and must never resolve to a real paper. */}
          <p>{c.treatmentPlan.summary}</p>
          {c.treatmentPlan.steps.length > 0 && (
            <ol className="steps">
              {c.treatmentPlan.steps.map((s, i) => (
                <li key={i}>
                  <div className="step-title">{s.title}</div>
                  {s.detail && (
                    <div className="muted small">{s.detail}</div>
                  )}
                  {s.citation && (
                    <a className="cite" href={s.citation.url} target="_blank" rel="noreferrer">
                      {s.citation.label}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
          {c.treatmentPlan.caseFinding && (
            <div className="case-finding">
              <strong>Surgical case-finding</strong>
              <p className="muted small">{c.treatmentPlan.caseFinding.summary}</p>
              <ul>
                {c.treatmentPlan.caseFinding.sites.map((s, i) => (
                  <li key={i}>
                    {s.url ? (
                      <a className="cite" href={s.url} target="_blank" rel="noreferrer">
                        {s.label}
                      </a>
                    ) : (
                      s.label
                    )}
                    {s.note && <span className="muted small"> — {s.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {h ? (
        <div className="hypo-detail">
          <div className="panel-head">
            <h3>{h.name}</h3>
            <span className={`status-chip ${h.status}`}>{h.status}</span>
          </div>
          {h.description && (
            <>
              {/* The toggle sits outside the clamped paragraph — inside it, the
                  line-clamp hid the very control needed to un-clamp. The text
                  still renders through <Cited> so it keeps its source markers. */}
              <p className={`hypo-desc ${descOpen ? "open" : "clamp"}`}>
                <Cited text={h.description} sources={c.sources} />
              </p>
              <button className="desc-toggle" onClick={() => setDescOpen((v) => !v)}>
                {descOpen ? "show less" : "show more"}
              </button>
            </>
          )}
          <div className="prob-line">
            {probabilityMode(c, h) === "unavailable" ? "Clinical probability" : "Probability"} <b>{probabilityLabel(c, h)}</b>
            {rarityLabel(h, probabilityMode(c) === 'illustrative') && <span className="zebra-tag">{rarityLabel(h, probabilityMode(c) === 'illustrative')}</span>}
          </div>
          {probabilityMode(c) !== 'illustrative' && ordinalIndex >= 0 && <p className="small">Agent rank #{ordinalIndex + 1} (model judgment)</p>}
          <RarityReference h={h} />
          {h.baseRateNote && (
            <div className="baserate">
              <strong>Base-rate prior</strong>
              <p className="muted small">
                <Cited text={h.baseRateNote} sources={c.sources} />
              </p>
            </div>
          )}
          {codes.length > 0 && (
            <div className="codes">
              <strong>Codes</strong>
              <ul>
                {codes.map((c2, i) => (
                  <li key={i}>
                    {c2.system}: <code>{c2.code}</code> {c2.display}
                    {c2.url && <a className="cite" href={c2.url} target="_blank" rel="noreferrer"> Official reference</a>}
                    {c2.reasoning && <div className="muted small">{c2.reasoning}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h.evidenceFor.length > 0 && (
            <div className="ev-block">
              <strong>Supporting evidence</strong>
              <ul>
                {h.evidenceFor.map((e, i) => (
                  <li key={i} className="supports">
                    {findingsById[e.findingId]?.hypothetical && <span className="hypothetical-badge">Hypothetical</span>}
                    <Cited
                      text={findingsById[e.findingId]?.summary || e.weight}
                      sources={c.sources}
                    />
                    <SourceChips ids={findingsById[e.findingId]?.sourceIndices} sources={c.sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h.evidenceAgainst.length > 0 && (
            <div className="ev-block">
              <strong>Contradicting evidence</strong>
              <ul>
                {h.evidenceAgainst.map((e, i) => (
                  <li key={i} className="against">
                    {findingsById[e.findingId]?.hypothetical && <span className="hypothetical-badge">Hypothetical</span>}
                    <Cited
                      text={findingsById[e.findingId]?.summary || e.weight}
                      sources={c.sources}
                    />
                    <SourceChips ids={findingsById[e.findingId]?.sourceIndices} sources={c.sources} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h.discriminatingTests?.length ? (
            <div className="ev-block">
              <strong>Discriminating tests</strong>
              <ul>
                {h.discriminatingTests.map((t, i) => (
                  <li key={i}>
                    {t.name}{" "}
                    <span className="muted small">
                      — <Cited text={t.rationale} sources={c.sources} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        !c.workingDiagnosis && (
          <p className="muted small detail-empty">
            Select a hypothesis node in the tree to inspect its evidence, codes, and base rate.
          </p>
        )
      )}
    </div>
  );
}
