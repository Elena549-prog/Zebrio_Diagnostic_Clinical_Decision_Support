/**
 * Recipe 1 — Presentation & intake. Content for the in-app docs recipe.
 * Source: web/src/scenarios.ts, server/domain/case-factory.ts.
 */

import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function PresentationRecipe() {
  const recipe = getRecipe("presentation")!;
  return (
    <article className="recipe">
      <RecipeHeader recipe={recipe} />

      <p>
        A Case starts from a <strong>Presentation</strong>: the patient's reason
        for encounter plus the preliminaries already collected at intake. This is
        the seed the whole diagnostic process branches from.
      </p>

      <h2 className="docs-h2">The four parts of a Presentation</h2>
      <ul>
        <li><strong>Chief complaint</strong> — the reason for the encounter, in the patient's words.</li>
        <li><strong>History</strong> — the story of the present illness.</li>
        <li><strong>Observations</strong> — vitals, exam, preliminary labs.</li>
        <li><strong>Demographics</strong> — age, sex, race/ethnicity, location, comorbidities. These provide context for the differential.</li>
      </ul>

      <h2 className="docs-h2">How a scenario becomes a Case</h2>
      <p className="muted small">
        Source: <code>web/src/scenarios.ts</code> (the seed), <code>server/domain/case-factory.ts</code> (the creation).
      </p>
      <pre className="docs-code">{`// a scenario is just a Presentation + a title
export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  presentation: Presentation;
}

// the UI POSTs it to the server, which creates the Case
POST /api/cases  { chiefComplaint, history, observations, demographics, title }`}</pre>

      <p>
        The home page offers pre-authored scenarios so you can start a case in one
        click. A Blank case lets you write your own presentation. Either way, the
        server creates a Case with an empty tree and the round cycle ready to run.
      </p>

      <h2 className="docs-h2">Why demographics matter up front</h2>
      <p>
        Age, location, comorbidities, and other context can change which hypotheses
        deserve attention. A numerical prior requires evidence appropriate to the
        presenting population and care setting. The live prototype keeps that
        distinction explicit: relative ranking is available; calibrated probability is not.
      </p>

      <RecipeFooter slug="presentation" />
    </article>
  );
}
