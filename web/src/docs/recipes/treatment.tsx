/**
 * Recipe 8 — Treatment plan & surgical case-finding. Source: server/domain/treatment.ts, server/domain/agent-definitions.ts.
 */

import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function TreatmentRecipe() {
  const recipe = getRecipe("treatment")!;
  return (
    <article className="recipe">
      <RecipeHeader recipe={recipe} />

      <p>
        After a clinician-confirmed working diagnosis, a <strong>second agent</strong> — the treatment
        planner — proposes a management plan: first-line therapy, escalation, and
        any procedure or surgery with its indications. It also performs{" "}
        <strong>surgical case-finding</strong>: searching where in the world the
        relevant procedure has been performed, with outcomes and technique notes.
      </p>

      <h2 className="docs-h2">The treatment plan</h2>
      <p className="muted small">
        Source: <code>server/domain/treatment.ts</code>, <code>POST /api/cases/:id/treat</code>.
      </p>
      <pre className="docs-code">{`treatmentPlan: {
  summary: "First-line: penicillin G ...",
  steps: [
    { title: "First-line therapy", detail: "...", citation? },
    { title: "Escalation", detail: "..." },
  ],
  caseFinding?: {
    summary: "Where valve replacement has been performed ...",
    sites: [{ label, url?, note? }],
  },
  createdAt
}`}</pre>

      <h2 className="docs-h2">Source-backed suggestions</h2>
      <p>Claude drafts the plan using the available case evidence and retrieved web references. Specialized-site suggestions must include inspectable sources or explicitly state that none were found. The dedicated evidence module will replace the temporary retrieval adapter.</p>

      <div className="docs-callout">
        <strong>Decision support, not a prescription.</strong> The plan is explicit
        that it is for a licensed clinician. The surgical case-finding is
        inspiration, not a recommendation.
      </div>

      <RecipeFooter slug="treatment" />
    </article>
  );
}
