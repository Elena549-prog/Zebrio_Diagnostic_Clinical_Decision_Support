/**
 * Recipe 3 — The hypothesis tree. Source: web/src/DecisionTree.tsx, server/domain/engine.ts.
 */

import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function TreeRecipe() {
  const recipe = getRecipe("tree")!;
  return (
    <article className="recipe">
      <RecipeHeader recipe={recipe} />

      <p>
        The differential is a <strong>tree of hypotheses</strong>, not a flat
        list. This is Arbor's headline property: the reasoning is{" "}
        <strong>retraceable</strong>. You can see which path was taken, and which
        were pruned and why.
      </p>

      <h2 className="docs-h2">Nodes are hypotheses</h2>
      <ul>
        <li><strong>live</strong> (blue) — on the active frontier.</li>
        <li><strong>branched</strong> (violet) — split into refined children.</li>
        <li><strong>working dx</strong> (green) — the converged hypothesis.</li>
        <li><strong>ruled out</strong> (grey, struck through) — refuted and kept for the trail.</li>
      </ul>

      <h2 className="docs-h2">Branching</h2>
      <p>
        When a finding splits a hypothesis, the engine marks the parent{" "}
        <em>branched</em> and emits child hypotheses that represent the refined
        possibilities. The tree grows <em>down</em>, not just sideways. Edges are
        labelled with the finding that caused the branch.
      </p>
      <pre className="docs-code">{`// a finding that splits "infection" into bacterial vs viral
{ hypotheses: [
    { name: "Bacterial infection", parent: "Infection" },
    { name: "Viral infection",     parent: "Infection" },
  ],
  ... }`}</pre>

      <h2 className="docs-h2">Ruled-out branches stay</h2>
      <p className="muted small">
        Source: <code>normalizeTree</code> in <code>server/domain/engine.ts</code>.
      </p>
      <p>
        A refuted hypothesis is set to <code>ruled_out</code> but is <strong>not
        deleted</strong>. It stays on the tree, dimmed, with the reason it was
        ruled out. This is what makes the reasoning auditable — the clinician can
        defend the conclusion by retracing the path.
      </p>

      <h2 className="docs-h2">Two views, one tree</h2>
      <p>
        The workspace offers a <strong>Tree</strong> view (the graph) and a{" "}
        <strong>List</strong> view (the ranked differential, top-to-bottom). Both
        show the same case; click a node or a row to open its detail (codes,
        evidence, discriminating tests) in the right panel.
      </p>

      <div className="docs-callout">
        <strong>Retraceability</strong> is the difference between Arbor and a
        flat-differential tool. The flat list shows <em>what</em> the top
        candidates are. The tree shows <em>how you got there</em>.
      </div>

      <RecipeFooter slug="tree" />
    </article>
  );
}
