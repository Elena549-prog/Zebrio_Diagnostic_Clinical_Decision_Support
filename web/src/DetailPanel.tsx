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
import { Cited } from "./Cite.js";
import type { Case, Hypothesis } from "./types.js";
import * as api from "./api.js";
import { probabilityMode } from "./probabilityDisplay.js";
import { HypothesisDetails } from "./HypothesisDetails.js";

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
  const [error, setError] = useState<string | null>(null);

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
        <HypothesisDetails key={h.id} c={c} h={h} />
      ) : (
        !c.workingDiagnosis && (
          <p className="muted small detail-empty">
            Select a hypothesis node in the tree to inspect its evidence, codes, and base rate.
          </p>
        )
      )}
      {interactive && canConverge && (
        <div className="hypothesis-confirm-footer">
          {error && <div className="na-err" role="alert">{error}</div>}
          <p className="small muted">
            {h?.status === "live" ? "Selected hypothesis" : pendingCandidate ? "Proposed hypothesis" : "Leading hypothesis"}: <strong>{selectedCandidate!.name}</strong>
          </p>
          {h && h.status !== "live" && <p className="small hypothesis-target-note">Viewing {h.name} ({h.status}); confirmation targets {selectedCandidate!.name}.</p>}
          <button onClick={setWorkingDx} disabled={busy}>Confirm working dx</button>
          <p className="small muted">Review the evidence before confirming.</p>
        </div>
      )}
    </div>
  );
}
