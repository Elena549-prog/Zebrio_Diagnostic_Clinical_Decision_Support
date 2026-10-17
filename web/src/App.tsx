/**
 * Arbor — differential-diagnosis decision-tree UI.
 *
 * The app shell (Clinical Precision chrome) wraps every view with a top app
 * bar. Inside it, a light hash-router switches between
 * Home, the Workspace (live case console), the Tutorial (canned walk-through),
 * and Docs (in-app recipes). The Workspace is a linear NextAction rail over a
 * data-rich EvidencePanel, a Tree/List canvas toggle, a DetailPanel, and a
 * bottom Timeline.
 *
 * Routing is a small `view` state plus history state so the back button and
 * shareable URLs work — no router dependency.
 */

import { useEffect, useRef, useState } from "react";
import { DecisionTree } from "./DecisionTree.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { ChatPanel } from "./ChatPanel.js";
import { DetailPanel } from "./DetailPanel.js";
import { NextAction } from "./NextAction.js";
import { RankedDifferential } from "./RankedDifferential.js";
import { Home } from "./Home.js";
import { Docs } from "./docs/Docs.js";
import { Tutorial } from "./Tutorial.js";
import { AppShell, type View } from "./AppShell.js";
import { Timeline } from "./Timeline.js";
import { SCENARIOS, type Scenario, findScenario } from "./scenarios.js";
import { TUTORIAL_STEPS } from "./tutorialCase.js";
import * as api from "./api.js";
import { caseAtFrame } from "./timeTravel.js";
import type { Case, Presentation } from "./types.js";
import { probabilityExplanation } from "./probabilityDisplay.js";

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("docs")) return "docs";
  if (h.startsWith("tutorial")) return "tutorial";
  if (h.startsWith("workspace")) return "workspace";
  return "home";
}

export function App() {
  const [view, setView] = useState<View>(() => viewFromHash());
  const [c, setCase] = useState<Case | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeVsList, setTreeVsList] = useState<"tree" | "list">("tree");
  const [chatOpen, setChatOpen] = useState(false);
  /** Selected history frame, or null when watching the present. */
  const [frameIdx, setFrameIdx] = useState<number | null>(null);
  const [forkingEnabled, setForkingEnabled] = useState(false);
  const [caseOptions, setCaseOptions] = useState<Case[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const activeCaseIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  function activateCase(next: Case) {
    activeCaseIdRef.current = next.id;
    setCase(next);
    setSelectedId(null);
    setFrameIdx(null);
    setChatOpen(false);
    setWorkspaceError(null);
  }

  // Ignore delayed updates from a parent after switching to an exploration.
  function updateActiveCase(next: Case) {
    if (activeCaseIdRef.current === next.id) setCase(next);
  }

  async function openCase(id: string) {
    if (busy) return;
    setBusy(true);
    setWorkspaceError(null);
    try { activateCase(await api.getCase(id)); go('workspace'); }
    catch (e) { setWorkspaceError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function forkFromFrame() {
    const frame = frameIdx === null ? undefined : c?.history[frameIdx];
    if (!c || !frame || !forkingEnabled || busy) return;
    setBusy(true);
    setWorkspaceError(null);
    try { activateCase(await api.forkCase(c.id, frame.seq)); }
    catch (e) { setWorkspaceError((e as Error).message); }
    finally { setBusy(false); }
  }

  // Keep the view in sync with the hash (back button, shareable URL).
  useEffect(() => {
    const onPop = () => setView(viewFromHash());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

  function go(v: View) {
    setView(v);
    const hash =
      v === "docs"
        ? "#/docs"
        : v === "workspace"
          ? "#/workspace"
          : v === "tutorial"
            ? "#/tutorial"
            : "#/";
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }

  // Subscribe to the live SSE stream for the active case.
  useEffect(() => {
    if (!c) return;
    let subscribed = true;
    const caseId = c.id;
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = api.streamCase(c.id, (ev) => {
      if (!subscribed || activeCaseIdRef.current !== caseId) return;
      if (ev.kind === "snapshot" && ev.payload) {
        updateActiveCase(ev.payload as Case);
      } else if (ev.kind === "round" || ev.kind === "finding" || ev.kind === "diagnosis" || ev.kind === "treatment") {
        api.getCase(caseId).then((next) => {
          if (subscribed) updateActiveCase(next);
        }).catch(() => {});
      }
    });
    return () => {
      subscribed = false;
      if (unsubRef.current) unsubRef.current();
    };
  }, [c?.id]);

  useEffect(() => {
    let active = true;
    api.listCases().then((cases) => { if (active) setCaseOptions(cases); }).catch(() => {});
    return () => { active = false; };
  }, [c?.id]);

  // A tutorial scenario enters the scripted walk-through (no live API);
  // a normal scenario starts a live case against the API.
  function startScenario(s: Scenario) {
    if (s.tutorial) {
      go("tutorial");
      return;
    }
    startScenarioLive(s);
  }

  async function startScenarioLive(s: Scenario) {
    setBusy(true);
    try {
      const created = await api.createCase(s.presentation, s.title);
      activateCase(created);
      go("workspace");
    } catch (e) {
      alert(`Failed to start: ${(e as Error).message}\nCheck the live setup notice on the home page.`);
    } finally {
      setBusy(false);
    }
  }

  // "Run this case for real" — exit the tutorial into a live run of the
  // underlying scenario the tour was based on.
  function exitTutorialToLive() {
    const tut = SCENARIOS.find((s) => s.tutorial);
    const live = tut?.liveScenarioId ? findScenario(tut.liveScenarioId) : undefined;
    startScenarioLive(live ?? { ...tut!, tutorial: false });
  }

  async function startBlank(presentation: Presentation, title: string) {
    setBusy(true);
    try {
      const created = await api.createCase(presentation, title);
      activateCase(created);
      go("workspace");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function newCase() {
    if (busy) return;
    activeCaseIdRef.current = null;
    setCase(null);
    setSelectedId(null);
    setFrameIdx(null);
    setChatOpen(false);
    setWorkspaceError(null);
    go("home");
  }

  const inCase = view === "workspace" || view === "tutorial";
  // For the tutorial, use the first canned snapshot's identity in the app bar
  // (the name/location don't change across steps; the live `c` is null there).
  const shellCase = view === "tutorial" ? TUTORIAL_STEPS[0]!.case : c;

  return (
    <AppShell view={view} c={inCase ? shellCase : null} onGo={go} onNewCase={newCase} busy={busy}
      caseActions={c && <div className="fork-controls">
        {caseOptions.length > 1 && <select aria-label="Switch case or exploration" value={c.id} disabled={busy}
          onChange={(e) => openCase(e.target.value)}>
          {caseOptions.map((option) => <option key={option.id} value={option.id}>
            {option.title} · {option.id.slice(-5)}
          </option>)}
        </select>}
        <button type="button" role="switch" aria-checked={forkingEnabled} aria-label="Forking"
          className={`fork-switch ${forkingEnabled ? 'enabled' : ''}`}
          onClick={() => setForkingEnabled((value) => !value)}>
          <span className="fork-switch-track" aria-hidden="true"><span /></span>
          Forking <span className="fork-switch-state">{forkingEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>}
    >
      {view === "docs" ? (
        <Docs />
      ) : view === "tutorial" ? (
        <Tutorial
          onExitToLive={exitTutorialToLive}
          onExitToHome={() => go("home")}
        />
      ) : view === "workspace" && c ? (
        (() => {
          // The frame drives every panel, so the whole workspace travels
          // together. Actions still act on the live case — see `reviewing`.
          const frame = frameIdx === null ? undefined : c.history?.[frameIdx];
          const vc = frame ? caseAtFrame(c, frame) : c;
          const reviewing = !!frame;
          return (
        <div className={`workspace ${reviewing ? "reviewing" : ""}`}>
          <aside className="pane left">
            {c.forkOrigin && <div className="exploration-banner" role="note">
              <strong>What-if exploration</strong>
              <p className="small">Forked after “{c.forkOrigin.parentFrameLabel}”. New manual findings are hypothetical. The original case is unchanged.</p>
              <button className="ghost" disabled={busy} onClick={() => openCase(c.forkOrigin!.parentCaseId)}>Return to parent case</button>
            </div>}
            {reviewing ? (
              <div className="review-note">
                <div className="review-title">Reviewing a past step</div>
                <p className="muted small">
                  Showing the case as it stood at <strong>{frame!.label}</strong>. Actions are
                  paused while you look back — return to now to continue the case.
                </p>
                {forkingEnabled && <>
                  <p className="muted small">To try a different result, select the step before that result.</p>
                  <button onClick={forkFromFrame} disabled={busy}>{busy ? 'Opening exploration…' : 'Fork from here'}</button>
                </>}
              </div>
            ) : (
              <NextAction
                key={c.id}
                c={c}
                onUpdated={updateActiveCase}
                busy={busy}
                setBusy={setBusy}
                onNewCase={newCase}
              />
            )}
            <div className="na-divider" />
            <EvidencePanel c={vc} onSelectHypothesis={setSelectedId} />
          </aside>
          <main className="pane center">
            {workspaceError && <div className="na-err" role="alert">{workspaceError}</div>}
            <div className="probability-notice" role="note">{probabilityExplanation(vc)}</div>
            <div className="center-head">
              <h3>Reasoning tree</h3>
              <div className="view-toggle">
                <button
                  className={treeVsList === "tree" ? "on" : "ghost"}
                  onClick={() => setTreeVsList("tree")}
                >
                  Tree
                </button>
                <button
                  className={treeVsList === "list" ? "on" : "ghost"}
                  onClick={() => setTreeVsList("list")}
                >
                  List
                </button>
              </div>
            </div>
            {treeVsList === "tree" ? (
              <DecisionTree c={vc} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <RankedDifferential c={vc} selectedId={selectedId} onSelect={setSelectedId} />
            )}
            <Timeline key={c.id} c={c} frameIdx={frameIdx} onScrub={setFrameIdx} />
          </main>
          <aside className="pane right">
            <DetailPanel
              key={c.id}
              c={vc}
              selectedId={selectedId}
              onUpdated={updateActiveCase}
              busy={busy}
              setBusy={setBusy}
              interactive={!reviewing}
            />
            {/* The toggle is the dock's header, so the control and the thread
                it opens read as one unit anchored to the bottom of the pane. */}
            {!reviewing && <div className={`chat-dock ${chatOpen ? "open" : ""}`}>
              <button
                className="chat-toggle ghost"
                onClick={() => setChatOpen((v) => !v)}
                aria-expanded={chatOpen}
              >
                <span>Ask the engine</span>
                <span className="chat-caret">{chatOpen ? "▾" : "▴"}</span>
              </button>
              {chatOpen && <ChatPanel key={c.id} c={c} onUpdated={updateActiveCase} busy={busy} setBusy={setBusy} />}
            </div>}
          </aside>
        </div>
          );
        })()
      ) : (
        <Home
          savedCases={caseOptions}
          onOpenCase={openCase}
          onStartScenario={startScenario}
          onStartBlank={startBlank}
          busy={busy}
          onOpenDocs={() => go("docs")}
        />
      )}
    </AppShell>
  );
}

// Re-export so Docs can deep-link back into the demo scenarios if needed.
export { SCENARIOS };
