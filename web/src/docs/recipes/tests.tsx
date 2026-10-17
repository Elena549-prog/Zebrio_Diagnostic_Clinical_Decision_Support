/**
 * Recipe 5 — Tests as information gain (the HITL gate). Source: web/src/NextAction.tsx, server/index.ts.
 */

import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function TestsRecipe() {
  const recipe = getRecipe("tests")!;
  return (
    <article className="recipe">
      <RecipeHeader recipe={recipe} />

      <p>
        When the differential cannot be split by reasoning alone, the engine{" "}
        <strong>proposes a test</strong> — not the test that confirms the
        favorite, but one intended to <strong>distinguish the hypotheses</strong>{" "}
        over the remaining live hypotheses. Then it pauses. The clinician owns
        the order and the result. This is the human-in-the-loop (HITL) gate.
      </p>

      <h2 className="docs-h2">The gate in the UI</h2>
      <p className="muted small">
        Source: <code>web/src/NextAction.tsx</code>. The finding form renders
        inline with the gate — no left/right ping-pong.
      </p>
      <p>
        When the engine proposes a test, the NextAction rail shows the test name
        and rationale, and the finding-entry form appears right there. Enter the
        result, pick its direction (supports / against / neutral), and click{" "}
        <strong>"Add result &amp; advance"</strong> — one action enters the
        finding and advances the next round.
      </p>

      <h2 className="docs-h2">The test proposal</h2>
      <pre className="docs-code">{`// the engine's decision is "test":
decision: {
  kind: "test",
  name: "Urgent arthrocentesis of the most inflamed joint",
  rationale: "Maximum information gain: splits septic from post-streptococcal.",
  discriminatesBetween: ["Septic arthritis", "Post-streptococcal reactive arthritis"],
}`}</pre>

      <h2 className="docs-h2">Linking the result to the test</h2>
      <p className="muted small">
        Source: <code>POST /api/cases/:id/finding</code> in <code>server/index.ts</code>.
      </p>
      <p>
        When the clinician enters a finding with a <code>testId</code>, the server
        marks that proposed test <code>resulted</code> and links the finding to
        it. The next round re-ranks the differential using the new finding.
      </p>

      <div className="docs-callout">
        <strong>The clinician is the decider at the gate.</strong> The engine
        proposes; the clinician orders the test, reads the result, and enters it.
        The agent never orders a test or records a result on its own — clinical
        safety.
      </div>

      <RecipeFooter slug="tests" />
    </article>
  );
}
