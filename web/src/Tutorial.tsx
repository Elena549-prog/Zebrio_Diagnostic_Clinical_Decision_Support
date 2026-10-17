/**
 * Tutorial — the guided-tutorial view. It renders the *real* workspace
 * (the same DecisionTree / EvidencePanel / DetailPanel / RankedDifferential
 * the live case uses) but drives it from a scripted sequence of canned `Case`
 * snapshots instead of the live API, so stepping is instant and every feature
 * is shown with real, interactive data.
 *
 * The TutorialRail replaces the live NextAction. DetailPanel runs with
 * `interactive={false}` so its live "Set working dx" / convergence actions —
 * which would call the API on the canned case — are hidden here.
 *
 * On each step, the hypothesis named in `highlightId` is auto-selected so the
 * teaching caption's "click the … node" cue is already satisfied and the
 * right panel shows the evidence the caption describes.
 */

import { useEffect, useState } from "react";
import { DecisionTree } from "./DecisionTree.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { DetailPanel } from "./DetailPanel.js";
import { RankedDifferential } from "./RankedDifferential.js";
import { Timeline } from "./Timeline.js";
import { TutorialRail } from "./TutorialRail.js";
import { TUTORIAL_STEPS } from "./tutorialCase.js";
import { probabilityExplanation } from "./probabilityDisplay.js";

interface Props {
  onExitToLive: () => void;
  onExitToHome: () => void;
}

export function Tutorial({ onExitToLive, onExitToHome }: Props) {
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeVsList, setTreeVsList] = useState<"tree" | "list">("tree");

  const s = TUTORIAL_STEPS[step]!;

  // Clamp the step into range and guard against an empty array, so the
  // rendered snapshot is always defined.
  const c = { ...s.case, probabilityMode: "illustrative" as const };

  // Auto-select the highlighted hypothesis on each step so the right panel
  // shows the evidence the caption describes.
  useEffect(() => {
    setSelectedId(s.highlightId ?? null);
  }, [step, s.highlightId]);

  function go(n: number) {
    setStep((prev) => Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, n ?? prev)));
  }

  return (
    <div className="workspace">
      <aside className="pane left">
        <TutorialRail step={step} onStep={go} onExitToLive={onExitToLive} />
        <div className="na-divider" />
        <EvidencePanel c={c} />
      </aside>
      <main className="pane center">
        <div className="probability-notice" role="note">{probabilityExplanation(c)}</div>
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
          <DecisionTree c={c} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <RankedDifferential c={c} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {/* The tour's tape is the whole tour, so the scrubber doubles as the
            step control: drag back to revisit a step, or press play to watch
            the whole differential build itself. */}
        <Timeline
          c={TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]!.case}
          frameIdx={step}
          onScrub={(i) => setStep(i ?? step)}
          stepMode
        />
      </main>
      <aside className="pane right">
        <DetailPanel
          c={c}
          selectedId={selectedId}
          onUpdated={() => {}}
          busy={false}
          setBusy={() => {}}
          interactive={false}
        />
        <button className="chat-toggle ghost" onClick={onExitToHome}>
          ← Leave tutorial
        </button>
      </aside>
    </div>
  );
}
