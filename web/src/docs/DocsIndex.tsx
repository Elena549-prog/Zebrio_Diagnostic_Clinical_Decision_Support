/**
 * DocsIndex — the /docs home. The building blocks of Arbor, the minimal flow
 * (the full round-trip), the agent-vs-client responsibilities, the recipe card
 * grid, and the "Design decisions" note (the ADR-equivalent). Mirrors the
 * inspiration demo's `docs/page.tsx`.
 */

import { RECIPES } from "./recipes.js";

export function DocsIndex() {
  return (
    <div className="docs-index">
      <h1 className="docs-h1">Arbor Recipes</h1>
      <p className="docs-lead muted">
        The recipe documentation lives inside this app — not in a separate site.
        The demo app is both the runnable reference and the documentation. Each
        recipe explains one building block and links to the live feature.
      </p>

      <div className="docs-callout">
        These recipes are also mirrored as <strong>markdown</strong> at{" "}
        <code>docs/recipes/</code>, and the repo root has an{" "}
        <code>AGENTS.md</code> entry point — so an LLM (or a teammate) can read
        the docs without running the app. New here? Run the <strong>Guided
        tour</strong> scenario on the home page for a scripted walk-through of
        every feature.
      </div>

      <h2 className="docs-h2">The building blocks</h2>
      <ol className="docs-blocks">
        <li>
          <strong>Presentation</strong> — <code>web/src/scenarios.ts</code>. The
          seed a case branches from: chief complaint, history, observations,
          demographics.
        </li>
        <li>
          <strong>The round</strong> — <code>server/domain/engine.ts</code>. One
          pass: gather evidence → update the differential → decide what's next.
        </li>
        <li>
          <strong>The tree</strong> — <code>web/src/DecisionTree.tsx</code>. The
          differential is a tree of hypotheses; pruned branches stay visible.
        </li>
        <li>
          <strong>The HITL gate</strong> — <code>web/src/NextAction.tsx</code>.
          When the engine proposes a test, the clinician enters the result; the
          cycle resumes.
        </li>
        <li>
          <strong>The working diagnosis</strong> — the clinician confirms the
          converged hypothesis; the reasoning trail records the path.
        </li>
        <li>
          <strong>The treatment plan</strong> — <code>server/domain/treatment.ts</code>.
          A second agent proposes management + surgical case-finding.
        </li>
      </ol>

      <h2 className="docs-h2">The minimal flow</h2>
      <p className="muted small">
        One full case, start to finish, against the Arbor server:
      </p>
      <pre className="docs-code">{`# 1. create a case from a presentation
POST /api/cases            { chiefComplaint, history, observations, demographics }

# 2. advance a round — the engine generates the differential + proposes a test
POST /api/cases/:id/advance

# 3. enter the test result (the HITL gate)
POST /api/cases/:id/finding  { summary, direction, testId }

# 4. advance again — the differential re-ranks; repeat until converged
POST /api/cases/:id/advance

# 5. set the working diagnosis
POST /api/cases/:id/diagnose

# 6. build the treatment plan
POST /api/cases/:id/treat`}</pre>

      <h2 className="docs-h2">What the agent does vs what the clinician owns</h2>
      <div className="docs-split">
        <div>
          <h3 className="docs-h3">Agent side</h3>
          <ul>
            <li>Generates and updates the differential.</li>
            <li>Branches a hypothesis when a finding splits it.</li>
            <li>Proposes tests intended to distinguish the remaining hypotheses.</li>
            <li>Collects source-linked web evidence and coding references.</li>
          </ul>
        </div>
        <div>
          <h3 className="docs-h3">Client side</h3>
          <ul>
            <li>Orders the test and enters the finding.</li>
            <li>Confirms the working diagnosis.</li>
            <li>Reads the reasoning trail and the treatment plan.</li>
            <li>Holds the verdict — the agent is decision support, never the decider.</li>
          </ul>
        </div>
      </div>

      <h2 className="docs-h2">The recipes</h2>
      <div className="docs-recipe-grid">
        {RECIPES.map((r) => (
          <a key={r.slug} href={`#/docs/${r.slug}`} className="docs-recipe-card">
            <div className="docs-recipe-card-num">{r.number}</div>
            <div className="docs-recipe-card-body">
              <h3 className="docs-recipe-card-title">{r.title}</h3>
              <p className="docs-recipe-card-desc muted small">{r.description}</p>
            </div>
          </a>
        ))}
      </div>

      <h2 className="docs-h2">Design decisions</h2>
      <div className="docs-architecture-note">
        <p>
          Arbor uses a <strong>tree, not a flat list</strong>, for the
          differential. A finding that splits a hypothesis branches it into
          children; a ruled-out branch is kept (dimmed), not deleted, so the
          reasoning trail is auditable: <em>this is what I thought to arrive at
          this conclusion.</em>
        </p>
        <ul>
          <li>
            <strong>Tree, not flat list</strong> — retraceability is the headline
            property. Flat lists (DXplain-style) lose the path.
          </li>
          <li>
            <strong>HITL, not autonomous</strong> — the clinician orders tests,
            enters results, and confirms the verdict. Clinical safety.
          </li>
          <li>
            <strong>Model-driven merge</strong> — the LLM reasons; the server
            applies deterministic merge + normalization so the tree is always
            well-formed regardless of phrasing.
          </li>
          <li>
            <strong>Claude provides the LLM roles</strong> — temporary web and coding
            adapters support integration while the dedicated team modules are built.
          </li>
        </ul>
      </div>
    </div>
  );
}
