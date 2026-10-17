/**
 * Recipe 7 — Working diagnosis & reasoning trail. Source: server/domain/engine.ts, web/src/DetailPanel.tsx.
 */

import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function WorkingDiagnosisRecipe() {
  const recipe = getRecipe("working-diagnosis")!;
  return (
    <article className="recipe">
      <RecipeHeader recipe={recipe} />

      <p>
        When the engine proposes that the differential is stable, it{" "}
        <strong>proposes convergence</strong>. The clinician then sets the{" "}
        <strong>working diagnosis</strong> — the single root-cause the session
        concludes is most likely, with the evidence path that
        reached it.
      </p>

      <h2 className="docs-h2">Setting the working diagnosis</h2>
      <p className="muted small">
        Source: <code>POST /api/cases/:id/diagnose</code>, and the "Converged
        enough?" hint in <code>web/src/DetailPanel.tsx</code>.
      </p>
      <p>
        The engine may propose convergence (its decision is{" "}
        <code>converged</code>), or the clinician can set it when the
        differential is stable. The proposal does not confirm a diagnosis. When a hypothesis is selected, the detail
        panel shows a "Converged enough? <strong>Set working dx</strong>" hint —
        so the action is discoverable where you are looking at the leading
        hypothesis, not buried in a menu.
      </p>

      <h2 className="docs-h2">The reasoning trail</h2>
      <p className="muted small">
        Source: <code>buildReasoningTrail</code> in <code>server/domain/engine.ts</code>.
      </p>
      <p>
        The working diagnosis carries a <strong>reasoning trail</strong>: the path
        from the presentation down the tree to the converged hypothesis, plus the
        pruned siblings as "considered and ruled out." This is the auditable
        record a clinician retraces to defend the conclusion.
      </p>
      <pre className="docs-code">{`// the working diagnosis object
workingDiagnosis: {
  hypothesisId, name,
  confidence?,           // absent without validated numerical confidence
  reasoningTrail: [       // the path, narrated
    "Presentation",
    "Acute rheumatic fever — branched into ...",
    "Ruled out: Septic arthritis (ruled out by ...)",
    ...
  ],
  concludedAt
}`}</pre>

      <div className="docs-callout">
        <strong>The clinician confirms the verdict.</strong> The agent proposes;
        the clinician decides. The working diagnosis is never auto-locked — the
        clinician sets it, and the reasoning trail records why.
      </div>

      <RecipeFooter slug="working-diagnosis" />
    </article>
  );
}
