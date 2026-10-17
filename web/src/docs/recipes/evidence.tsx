import { RecipeHeader } from "../RecipeHeader.js";
import { RecipeFooter } from "../RecipeFooter.js";
import { getRecipe } from "../recipes.js";

export default function EvidenceRecipe() {
  return <article className="recipe">
    <RecipeHeader recipe={getRecipe("evidence")!} />
    <p>Patient findings and literature evidence serve different purposes. A paper can support a diagnostic claim; it cannot establish that a particular patient has a finding. The clinician records patient observations and test results.</p>
    <h2 className="docs-h2">Research and validation</h2>
    <p>The temporary evidence module searches the web through Tavily, retrieves source material, and asks Claude to assess support and limitations. The dedicated team evidence module will replace this adapter. A source link alone does not establish that a claim is correct or clinically applicable.</p>
    <h2 className="docs-h2">Sources and citations</h2>
    <p>A source is an artifact such as a guideline or paper. A citation is one use of that source in a finding or explanation. Sources live in one deduplicated, append-only pool per case. Their stable numbers connect the explanation to the bibliography and its clickable original links.</p>
    <p>Click a numbered marker to find its source. An uncited assertion has no marker. Inspect the supporting passage and source applicability before relying on it; unsupported claims and retrieval failures must remain visible.</p>
    <h2 className="docs-h2">Reading the findings</h2>
    <p>The findings panel groups evidence by hypothesis, with supporting and contradicting counts. Evidence affecting several hypotheses appears in each group. The timeline toggle restores chronological order, while the bottom case timeline lets you inspect previous complete states.</p>
    <h2 className="docs-h2">Coding</h2>
    <p>ICD-10-GM candidates appear in the hypothesis detail. They identify reference classifications; they are not proof of a diagnosis, a probability, or a finalized billing assignment.</p>
    <div className="docs-callout">Research-source quality, claim support, and suitability for a numerical model are separate checks. A verified quotation does not automatically qualify as an input to a patient-risk calculation.</div>
    <RecipeFooter slug="evidence" />
  </article>;
}
