/**
 * Home — the simple front door. Emulates the /wait-what skill: speak in plain
 * Simplified Technical English, in Arbor's ubiquitous language (CONTEXT.md),
 * and make the four questions a new reader asks immediately legible:
 *
 *   - What does the agent do?
 *   - What does the clinician (the client) own?
 *   - What do we split against?
 *   - What is this useful for?
 *
 * Then the scenario cards bridge into the workspace. No three-pane console
 * on the home page — that lives in the workspace.
 */

import { SCENARIOS, type Scenario } from "./scenarios.js";
import { RuntimeStatus } from "./RuntimeStatus.js";
import { useState } from "react";
import type { Case, Presentation, Sex } from "./types.js";

interface Props {
  onStartScenario: (s: Scenario) => void;
  onStartBlank: (presentation: Presentation, title: string) => void;
  busy: boolean;
  onOpenDocs: () => void;
  savedCases?: Case[];
  onOpenCase?: (id: string) => void;
}

export function Home({ onStartScenario, onStartBlank, busy, onOpenDocs, savedCases = [], onOpenCase }: Props) {
  const [blankOpen, setBlankOpen] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [history, setHistory] = useState("");
  const [observations, setObservations] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("unknown");
  const [location, setLocation] = useState("Germany");

  return (
    <div className="home">
      <div className="home-hero">
        <h1 className="home-title">Arbor 🌳</h1>
        <p className="home-lead">
          A retraceable differential diagnosis. A clinician and an agent work a
          case from <strong>presentation</strong> to <strong>working diagnosis</strong>{" "}
          to <strong>treatment plan</strong>. Every step stays on the tree.
        </p>

        <RuntimeStatus />

        {savedCases.length > 0 && onOpenCase && <div className="saved-case-picker">
          <label htmlFor="saved-case">Resume a case or exploration</label>
          <select id="saved-case" defaultValue="" disabled={busy} onChange={(e) => {
            if (e.target.value) onOpenCase(e.target.value);
          }}>
            <option value="" disabled>Select a case…</option>
            {savedCases.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.id.slice(-5)}</option>)}
          </select>
          <span className="muted small">Available until the local server restarts.</span>
        </div>}

        <div className="home-split">
          <div className="home-split-col agent">
            <div className="home-split-head">What the agent does</div>
            <ul>
              <li>Generates the <strong>differential</strong> — the set of plausible causes of the presentation.</li>
              <li>Branches a <strong>hypothesis</strong> into children when a finding splits its meaning.</li>
              <li>Proposes the next <strong>test</strong> — the one that best splits the remaining differential.</li>
              <li>Collects web evidence and source links to help you review each hypothesis.</li>
            </ul>
            <div className="home-split-tag">the agent reasons</div>
          </div>
          <div className="home-split-col client">
            <div className="home-split-head">What the clinician owns</div>
            <ul>
              <li>Orders the test and enters the <strong>finding</strong> (the result).</li>
              <li>Confirms the <strong>working diagnosis</strong>.</li>
              <li>Reads the <strong>reasoning trail</strong> and the treatment plan.</li>
              <li>Holds the verdict. The agent is decision <em>support</em>, never the decider.</li>
            </ul>
            <div className="home-split-tag">the clinician decides</div>
          </div>
        </div>

        <div className="home-answers">
          <div className="home-answer">
            <div className="home-q">What we split against</div>
            <p className="muted small">
              The differential is a <strong>tree</strong>, not a flat list. Pruned
              branches stay visible, so the reasoning is retraceable — this is
              what we split against in flat-list tools. And the clinician owns the
              verdict, not an autonomous machine — for clinical safety.
            </p>
          </div>
          <div className="home-answer">
            <div className="home-q">What it is useful for</div>
            <p className="muted small">
              A reference demo of agentic differential diagnosis powered by Claude.
              Use it to show how a decision-tree of hypotheses grows,
              branches, and narrows — with a human in the loop.
            </p>
          </div>
        </div>

        <button className="home-recipes" onClick={onOpenDocs}>
          Recipes →
        </button>
      </div>

      <div className="home-scenarios">
        <h2>Run a scenario</h2>
        <p className="muted small">
          Each scenario is a patient who just walked in. Run rounds, order tests
          at the gates, and watch the tree narrow — then a treatment plan.
        </p>
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`scenario-card${s.tutorial ? " tutorial-card" : ""}`}
              onClick={() => onStartScenario(s)}
              disabled={busy}
            >
              <h3>{s.title}</h3>
              <p className="muted small">{s.blurb}</p>
              <div className="demo small">
                {[
                  s.presentation.demographics.ageYears != null && `age ${s.presentation.demographics.ageYears}`,
                  s.presentation.demographics.sex,
                  s.presentation.demographics.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </button>
          ))}
          <button className="scenario-card blank" onClick={() => setBlankOpen((open) => !open)} disabled={busy} aria-expanded={blankOpen}>
            <h3>+ Blank case</h3>
            <p className="muted small">Write your own presentation.</p>
          </button>
        </div>
        {blankOpen && (
          <form className="intake-form" onSubmit={(e) => {
            e.preventDefault();
            if (!complaint.trim() || busy) return;
            onStartBlank({
              chiefComplaint: complaint.trim(),
              history: history.trim() || undefined,
              observations: observations.split("\n").map((s) => s.trim()).filter(Boolean),
              demographics: { ageYears: age ? Number(age) : undefined, sex, location: location.trim() || undefined },
            }, complaint.trim());
          }}>
            <h3>New presentation</h3>
            <label>Chief complaint<input required value={complaint} onChange={(e) => setComplaint(e.target.value)} /></label>
            <label>History<textarea rows={3} value={history} onChange={(e) => setHistory(e.target.value)} /></label>
            <label>Observations, one per line<textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} /></label>
            <div className="intake-demographics">
              <label>Age in years<input type="number" min="0" max="130" step="1" value={age} onChange={(e) => setAge(e.target.value)} /></label>
              <label>Sex<select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="unknown">Unknown</option><option value="male">Male</option><option value="female">Female</option><option value="intersex">Intersex</option>
              </select></label>
              <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            </div>
            <div className="na-actions">
              <button type="submit" disabled={busy || !complaint.trim()}>{busy ? "Creating…" : "Create case"}</button>
              <button type="button" className="ghost" onClick={() => setBlankOpen(false)} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
