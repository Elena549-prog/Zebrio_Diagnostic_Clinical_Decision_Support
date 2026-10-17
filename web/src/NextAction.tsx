/**
 * NextAction — the spine of the workspace. It always shows, in one place,
 * where the case is and what to do next, so the round cycle is a single linear
 * path instead of left/right ping-pong.
 *
 * Modeled on the inspiration demo's GuidedFlow step panel + "next form"
 * suggestion banner: a stage line, a completed-steps trail, and a prominent
 * "next action" card whose content depends on the case state. When the engine
 * is awaiting a test result (the HITL gate), the finding-entry form renders
 * inline right here — co-located with the gate that asked for it.
 */

import { useEffect, useState } from "react";
import type { Case } from "./types.js";
import * as api from "./api.js";
import { demoSuggestions, intentLabel, type DemoSuggestion } from "./demoSuggestions.js";
import { SCENARIOS } from "./scenarios.js";

interface Props {
  c: Case;
  onUpdated: (c: Case) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onNewCase: () => void;
}

/** A human label for the current stage of the case. */
function stageLabel(c: Case): string {
  if (c.pendingDiagnosis) return "awaiting your diagnostic review";
  if (c.awaitingHitl) return "awaiting your test result";
  if (c.status === "converged") return c.workingDiagnosis ? "working diagnosis confirmed" : "awaiting your diagnostic review";
  if (c.status === "treatment" || c.status === "closed") return "treatment plan";
  if (c.round === 0) return "intake";
  return "reasoning";
}

/** Completed steps trail: ✓ Intake · ✓ Round 1 · ✓ Round 2 … */
function completedSteps(c: Case): { label: string; done: boolean }[] {
  const steps: { label: string; done: boolean }[] = [{ label: "Intake", done: true }];
  for (let r = 1; r <= c.round; r++) steps.push({ label: `Round ${r}`, done: true });
  // The current frontier step is "in progress", not done.
  if (steps.length > 0) steps[steps.length - 1]!.done = false;
  return steps;
}

interface RetrievalStatus { status: string; sourceCount: number; acceptedFindings: number; limitations: string[] }
interface CodingStatus { status: string; attached: number }

/** What the latest round's retrieval and coding steps actually produced. */
function roundTools(c: Case): { retrieval?: RetrievalStatus; coding?: CodingStatus } {
  const out: { retrieval?: RetrievalStatus; coding?: CodingStatus } = {};
  for (const e of c.events) {
    if (e.round !== c.round || !e.payload || typeof e.payload !== "object") continue;
    const p = e.payload as { retrieval?: RetrievalStatus; coding?: CodingStatus };
    if (p.retrieval) out.retrieval = p.retrieval;
    if (p.coding) out.coding = p.coding;
  }
  return out;
}

function RoundToolStatus({ c }: { c: Case }) {
  const { retrieval, coding } = roundTools(c);
  if (c.round === 0 || (!retrieval && !coding)) return null;
  const degraded = retrieval && retrieval.status !== "ready";
  return (
    <div className={`round-tools ${degraded ? "degraded" : ""}`} role="status">
      {retrieval && (
        <div>
          <strong>Round {c.round} evidence:</strong>{" "}
          {retrieval.status === "unavailable" || retrieval.sourceCount === 0
            ? "no new web literature was retrieved. Ranking may still use earlier sources, findings and local population references."
            : `${retrieval.sourceCount} source(s), ${retrieval.acceptedFindings} passage-checked finding(s)${retrieval.status === "partial" ? " — partial; some claims could not be checked" : ""}. Quotation checks show provenance, not clinical validity.`}
          {retrieval.limitations.length > 0 && (
            <details className="small"><summary>Limitations ({retrieval.limitations.length})</summary>
              <ul>{retrieval.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {coding && (
        <div>
          <strong>Coding (temporary adapter):</strong>{" "}
          {coding.status === "unavailable"
            ? "unavailable this round; no codes attached."
            : coding.attached > 0
              ? `${coding.attached} ICD-10-GM suggestion(s) verified against the official catalogue. A coding suggestion is not a confirmed diagnosis.`
              : "no patient code attached; suggestions may require clarification. Suspected diagnoses are not coded as confirmed."}
        </div>
      )}
    </div>
  );
}

export function NextAction({ c, onUpdated, busy, setBusy, onNewCase }: Props) {
  // ---- inline finding form (the HITL gate) ----
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [direction, setDirection] = useState<"supports" | "against" | "neutral">("supports");
  const [testId, setTestId] = useState<string>("");
  const [slow, setSlow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset the inline form when the gate we're answering changes.
  const pendingTests = c.tests.filter((t) => t.status === "proposed" || t.status === "ordered");
  useEffect(() => {
    setSummary("");
    setDetail("");
    setTestId(pendingTests[0]?.id ?? "");
    setDirection("supports");
  }, [c.awaitingHitl, c.round, pendingTests.length]);

  // "Still thinking" hint after a few seconds (reused from ChatPanel).
  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [busy, c.round]);

  const steps = completedSteps(c);
  const stage = stageLabel(c);
  const awaitingTest = c.awaitingHitl && !c.pendingDiagnosis;
  // Clinicians can record findings at any open stage, not only at a test gate.
  // A proposed diagnosis can only be reconsidered by adding a finding first.
  const findingOpen = !c.workingDiagnosis && (awaitingTest || !!c.pendingDiagnosis || c.round > 0 || !!c.forkOrigin);
  const selectedTest = pendingTests.find((t) => t.id === testId) ?? pendingTests[0];
  const suggestions = demoSuggestions(c, selectedTest?.id);
  const preset = SCENARIOS.find((s) => s.liveDemo && c.title.replace(/^What-if: /, "") === s.title);
  const resultSheet = !c.forkOrigin ? preset?.syntheticResults ?? [] : [];
  const diagnosisCandidate = c.pendingDiagnosis
    ? c.hypotheses[c.pendingDiagnosis.hypothesisId]
    : Object.values(c.hypotheses).filter((h) => h.status === "live").sort((a, b) => b.probability - a.probability)[0];

  async function advance() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await api.advance(c.id);
      onUpdated(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function diagnose() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await api.diagnose(c.id, { hypothesisId: diagnosisCandidate?.id });
      onUpdated(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function treat() {
    if (busy || !c.workingDiagnosis) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await api.treat(c.id);
      onUpdated(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Record the clinician's test result, then advance the reasoning round. */
  async function addResultAndAdvance(example?: DemoSuggestion) {
    const s = (example ? `Synthetic demo result — ${example.summary}` : summary).trim();
    if (busy || !s) return;
    setBusy(true);
    setErr(null);
    try {
      const afterFinding = await api.addFinding(c.id, {
        summary: s,
        detail: example ? example.detail : detail || undefined,
        direction: example?.direction ?? direction,
        source: "clinician",
        testId: example?.testId ?? (testId || undefined),
        hypothesisIds: example?.hypothesisIds,
      });
      onUpdated(afterFinding);
      const afterAdvance = await api.advance(c.id);
      onUpdated(afterAdvance);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Restore the original one-click demo path using the chosen result directly. */
  function applySuggestion(example: DemoSuggestion) {
    setSummary(`Synthetic demo result — ${example.summary}`);
    setDetail(example.detail ?? "");
    setDirection(example.direction);
    if (example.testId) setTestId(example.testId);
    void addResultAndAdvance(example);
  }

  /** Add a free observation/result without advancing (e.g. a side finding). */
  async function addFindingOnly() {
    if (busy || !summary.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const next = await api.addFinding(c.id, {
        summary,
        detail: detail || undefined,
        direction,
        source: "clinician",
        testId: testId || undefined,
      });
      onUpdated(next);
      setSummary("");
      setDetail("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="next-action">
      {/* completed-steps trail */}
      <div className="na-trail">
        {steps.map((s, i) => (
          <span key={i} className={`na-step ${s.done ? "done" : "now"}`}>
            {s.done && <span className="na-check">✓</span>}
            {s.label}
          </span>
        ))}
      </div>

      {/* stage line */}
      <div className="na-stage">
        Round {c.round || 0} · <span className="na-stage-label">{stage}</span>
      </div>

      <RoundToolStatus c={c} />

      {/* the prominent next-action card */}
      <div className="na-card">
        {awaitingTest ? (
          <>
            <div className="na-card-icon">→</div>
            <div className="na-card-text">
              <div className="na-card-label">Proposed test{selectedTest ? `: ${selectedTest.name}` : ""}</div>
              <div className="na-card-reason">{c.hitlPrompt}</div>
            </div>
          </>
        ) : c.round === 0 ? (
          <>
            <div className="na-card-icon">→</div>
            <div className="na-card-text">
              <div className="na-card-label">Start the reasoning</div>
              <div className="na-card-reason">
                Advance a round to generate the first differential from the presentation.
              </div>
            </div>
          </>
        ) : c.status === "converged" || c.pendingDiagnosis ? (
          <>
            <div className="na-card-icon">→</div>
            <div className="na-card-text">
              <div className="na-card-label">{c.workingDiagnosis ? "Working diagnosis confirmed" : "The engine proposes convergence"}</div>
              <div className="na-card-reason">
                {c.workingDiagnosis
                  ? `${c.workingDiagnosis.name}. Build the treatment plan next.`
                  : `${c.pendingDiagnosis?.name ?? "Review the hypotheses"}. ${c.pendingDiagnosis?.reason ?? "Review the evidence before confirming your working diagnosis."} Treatment planning starts after your confirmation.`}
              </div>
            </div>
          </>
        ) : c.status === "treatment" || c.status === "closed" ? (
          <>
            <div className="na-card-icon">✓</div>
            <div className="na-card-text">
              <div className="na-card-label">Treatment plan ready</div>
              <div className="na-card-reason">
                The case is complete. Start a new case to run another differential.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="na-card-icon">→</div>
            <div className="na-card-text">
              <div className="na-card-label">Advance another round</div>
              <div className="na-card-reason">
                Re-rank the differential with the findings so far. Or, if the
                differential is stable, set the working diagnosis.
              </div>
            </div>
          </>
        )}
      </div>

      {/* the action(s) for this state */}
      <div className="na-actions">
        {awaitingTest ? null : c.status === "converged" || c.pendingDiagnosis ? (
          c.workingDiagnosis ? (
            <button onClick={treat} disabled={busy}>
              {busy ? <span className="spinner" /> : null} Build treatment plan
            </button>
          ) : (
            <>
              <button onClick={diagnose} disabled={busy || !diagnosisCandidate}>
                {c.pendingDiagnosis ? "Confirm proposed working dx" : "Confirm leading working dx"}
              </button>
              {c.pendingDiagnosis && <span className="muted small">To reconsider instead, add a finding below and advance.</span>}
            </>
          )
        ) : c.status === "treatment" || c.status === "closed" ? (
          <button className="ghost" onClick={onNewCase} disabled={busy}>
            + New case
          </button>
        ) : (
          <>
            <button onClick={advance} disabled={busy}>
              {busy ? <span className="spinner" /> : null}{" "}
              {busy ? "Thinking…" : "Advance a round"}
            </button>
            {c.status === "reasoning" && (
              <button className="ghost" onClick={diagnose} disabled={busy || !diagnosisCandidate}>
                Confirm leading working dx
              </button>
            )}
          </>
        )}
        {busy && slow && (
          <span className="muted small slow-hint">
            Still working — gathering sources and reviewing the differential can take a minute.
          </span>
        )}
        {err && <div className="na-err">⚠️ {err}</div>}
      </div>

      {/* inline HITL finding form, co-located with the gate */}
      {findingOpen && (
        <div className="na-finding">
          <div className="na-finding-head">{c.forkOrigin ? 'Enter a hypothetical finding' : awaitingTest ? 'Enter the test result' : 'Add a clinician finding'}</div>
          {c.forkOrigin && <p className="small muted">Assumed for this exploration only, not an actual patient result.</p>}
          {pendingTests.length > 0 && (
            <select value={testId} onChange={(e) => setTestId(e.target.value)}>
              {pendingTests.map((t) => (
                <option key={t.id} value={t.id}>
                  result for: {t.name}
                </option>
              ))}
            </select>
          )}
          {awaitingTest && suggestions.length > 0 && (
            <div className="demo-suggestions">
              <div className="demo-suggestions-label label-caps">Synthetic example results</div>
              <p className="small muted">Generated from the current tree, not real test output. Clicking records it (prefixed “Synthetic demo result”) and runs a live round. To enter your own synthetic result, type it below.</p>
              <div className="demo-suggestions-row">
                {suggestions.map((example) => (
                  <button
                    key={example.intent}
                    className={`demo-chip ${example.intent}`}
                    title={intentLabel(example.intent)}
                    disabled={busy}
                    onClick={() => applySuggestion(example)}
                  >
                    <span className="demo-chip-badge">{example.badge}</span>
                    <span className="demo-chip-hint">{example.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {resultSheet.length > 0 && (
            <div className="result-sheet">
              <div className="demo-suggestions-label label-caps">Synthetic result sheet (live demo preset)</div>
              <p className="small muted">Fills the form only. Check it matches the proposed test, set the direction, then submit it yourself.</p>
              {resultSheet.map((text) => (
                <button key={text} type="button" className="ghost" disabled={busy} onClick={() => setSummary(text)}>{text}</button>
              ))}
            </div>
          )}
          <input
            placeholder="Finding summary, e.g. “chest X-ray: right lower lobe consolidation”"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <input
            placeholder="Detail (optional), e.g. “reference <200”"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <div className="dir-row">
            <label className={direction === "supports" ? "on" : ""}>
              <input type="radio" name="nad" checked={direction === "supports"} onChange={() => setDirection("supports")} /> supports
            </label>
            <label className={direction === "against" ? "on" : ""}>
              <input type="radio" name="nad" checked={direction === "against"} onChange={() => setDirection("against")} /> against
            </label>
            <label className={direction === "neutral" ? "on" : ""}>
              <input type="radio" name="nad" checked={direction === "neutral"} onChange={() => setDirection("neutral")} /> neutral
            </label>
          </div>
          <div className="na-finding-actions">
            <button onClick={() => addResultAndAdvance()} disabled={busy || !summary.trim()}>
              {busy ? <span className="spinner" /> : null} Add result &amp; advance
            </button>
            <button className="ghost" onClick={addFindingOnly} disabled={busy || !summary.trim()}>
              Add finding only
            </button>
          </div>
          {err && <div className="na-err">⚠️ {err}</div>}
        </div>
      )}
    </div>
  );
}
