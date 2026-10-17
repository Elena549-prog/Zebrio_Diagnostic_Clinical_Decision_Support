import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function AgentTeamRecipe() {
  return <article className="recipe">
    <RecipeHeader recipe={getRecipe("agent-team")!} />
    <p>Claude powers the reasoning roles. Ordinary server code owns the case state, tool execution, bounded round loop, and clinician gates.</p>
    <h2 className="docs-h2">The roles</h2>
    <table className="docs-team"><thead><tr><th>Role</th><th>Responsibility</th></tr></thead><tbody>
      <tr><td>Hypothesis engine</td><td>Proposes and re-ranks hypotheses, retains ruled-out branches, and proposes the next action.</td></tr>
      <tr><td>Evidence researcher and validator</td><td>Searches and retrieves web sources, checks supporting passages, and returns sources and limitations.</td></tr>
      <tr><td>Medical coding</td><td>Uses the German ICD-10-GM catalogue for reference-code candidates. Missing specificity must remain explicit.</td></tr>
      <tr><td>Treatment planner</td><td>Drafts management suggestions after the clinician confirms a working diagnosis.</td></tr>
    </tbody></table>
    <h2 className="docs-h2">Temporary team integrations</h2>
    <p>Web research and medical coding currently use temporary adapters so the full application can run while teammates build their modules. Tavily supplies retrieval; the Claude roles interpret the returned content. These are not Corti registry experts.</p>
    <h2 className="docs-h2">Numerical calculations</h2>
    <p>A deterministic model must have reviewed inputs, a defined population, and a recorded version before its output can be displayed as clinical probability. The live differential currently has relative ranking weights and reports clinical probability as unavailable. The guided tour contains synthetic teaching percentages.</p>
    <div className="docs-callout">The clinician orders tests, records findings, and confirms the diagnosis. A model convergence proposal cannot confirm a diagnosis or start treatment on its own.</div>
    <RecipeFooter slug="agent-team" />
  </article>;
}
