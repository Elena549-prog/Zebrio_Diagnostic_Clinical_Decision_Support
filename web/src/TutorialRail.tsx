/**
 * TutorialRail — the teaching surface for the guided tutorial. It replaces the
 * live NextAction rail with a scripted equivalent: a step progress trail, a
 * stage line, a teaching caption, a "what to look at" cue, and Prev / Next
 * stepping. An optional "Enter result & advance" button simulates the HITL gate
 * at the test step, so the tutorial demonstrates the gate without calling the
 * live API.
 *
 * Visuals stay white-theme: it reuses .na-* classes where they fit and adds a
 * few .tut-* classes for the tutorial-specific affordances.
 */

import { TUTORIAL_STEPS } from "./tutorialCase.js";
import { demoSuggestions, intentLabel } from "./demoSuggestions.js";

interface Props {
  step: number;
  onStep: (n: number) => void;
  onExitToLive: () => void;
}

export function TutorialRail({ step, onStep, onExitToLive }: Props) {
  const s = TUTORIAL_STEPS[step]!;
  const total = TUTORIAL_STEPS.length;
  const isLast = step === total - 1;
  const isGate = s.spotlight === "hitl-gate";
  const suggestions = demoSuggestions(s.case);
  const proposedTest = s.case.tests.find((t) => t.status === "proposed" || t.status === "ordered");

  const cue =
    s.spotlight === "presentation"
      ? "Read the presentation card on the left."
      : s.spotlight === "initial-diff"
      ? "Look at the tree, then click the 🦓 zebra node."
      : s.spotlight === "hitl-gate"
      ? "This is the test gate — the engine proposes, the clinician decides."
      : s.spotlight === "branching"
      ? "Watch the tree branch and the ruled-out node stay visible."
      : s.spotlight === "evidence"
      ? "Click the leading node; read its evidence on the right."
      : s.spotlight === "converge"
      ? "The working diagnosis and reasoning trail appear on the right."
      : s.spotlight === "treatment"
      ? "The treatment plan + case-finding appear on the right."
      : "";

  return (
    <div className="tutorial-rail">
      {/* step progress trail */}
      <div className="na-trail">
        {TUTORIAL_STEPS.map((ts, i) => (
          <span key={i} className={`na-step ${i < step ? "done" : i === step ? "now" : ""}`}>
            {i < step && <span className="na-check">✓</span>}
            {ts.label}
          </span>
        ))}
      </div>

      <div
        className="tut-progress"
        role="progressbar"
        aria-label="Tutorial progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
      >
        <span className="tut-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      <div className="na-stage">
        <span className="tut-stepnum">Step {step + 1} / {total}</span>
        <span aria-hidden="true">·</span>
        <span className="na-stage-label">{s.stage}</span>
      </div>

      {/* teaching card */}
      <div className="na-card tut-card">
        <div className="na-card-icon">★</div>
        <div className="na-card-text">
          <div className="na-card-label">{isGate && proposedTest ? `Proposed test: ${proposedTest.name}` : `Tutorial · ${s.label}`}</div>
          <div className="na-card-reason">{s.caption}</div>
          {cue && <div className="tut-cue">👉 {cue}</div>}
        </div>
      </div>

      {isGate && suggestions.length > 0 && (
        <div className="demo-suggestions">
          <div className="demo-suggestions-label label-caps">Example results for this demo</div>
          <p className="small muted">Illustrative choices. All continue to the same scripted result in this guided tour.</p>
          <div className="demo-suggestions-row">
            {suggestions.map((example) => (
              <button
                key={example.intent}
                className={`demo-chip ${example.intent}`}
                title={intentLabel(example.intent)}
                onClick={() => onStep(step + 1)}
              >
                <span className="demo-chip-badge">{example.badge}</span>
                <span className="demo-chip-hint">{example.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* step actions */}
      <div className="na-actions">
        <button className="ghost" onClick={() => onStep(step - 1)} disabled={step === 0}>
          ← Back
        </button>
        {isGate ? (
          <button onClick={() => onStep(step + 1)}>
            Enter result &amp; advance →
          </button>
        ) : isLast ? (
          <button className="ghost" onClick={onExitToLive}>
            Run this case for real →
          </button>
        ) : (
          <button onClick={() => onStep(step + 1)}>
            Next →
          </button>
        )}
      </div>

      {isLast && (
        <p className="muted small tut-exit-hint">
          You’ve seen the full run. “Run this case for real” starts a live
          version of this scenario against Claude — you drive the rounds
          and enter test results yourself.
        </p>
      )}
    </div>
  );
}
