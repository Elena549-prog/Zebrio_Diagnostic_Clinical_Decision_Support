/**
 * Docs — the in-app /docs route. Parses the hash (#/docs or #/docs/<slug>) to
 * render either the DocsIndex (the recipe grid + building blocks + design
 * decisions) or a single recipe page inside the DocsLayout sidebar. Mirrors the
 * inspiration demo's Next.js /docs layout, but as a Vite client-side route.
 */

import { useEffect, useState } from "react";
import { DocsLayout } from "./DocsLayout.js";
import { DocsIndex } from "./DocsIndex.js";
import { getRecipe } from "./recipes.js";
import PresentationRecipe from "./recipes/presentation.js";
import RoundRecipe from "./recipes/round.js";
import TreeRecipe from "./recipes/tree.js";
import HorsesZebrasRecipe from "./recipes/horses-zebras.js";
import TestsRecipe from "./recipes/tests.js";
import EvidenceRecipe from "./recipes/evidence.js";
import WorkingDiagnosisRecipe from "./recipes/working-diagnosis.js";
import TreatmentRecipe from "./recipes/treatment.js";
import AgentTeamRecipe from "./recipes/agent-team.js";

const RECIPES_CONTENT: Record<string, () => JSX.Element> = {
  presentation: PresentationRecipe,
  round: RoundRecipe,
  tree: TreeRecipe,
  "horses-zebras": HorsesZebrasRecipe,
  tests: TestsRecipe,
  evidence: EvidenceRecipe,
  "working-diagnosis": WorkingDiagnosisRecipe,
  treatment: TreatmentRecipe,
  "agent-team": AgentTeamRecipe,
};

function slugFromHash(): string | null {
  const h = window.location.hash.replace(/^#\/?/, "");
  // matches "#/docs/<slug>"
  const m = h.match(/^docs\/([^/?#]+)/);
  return m && m[1] ? m[1] : null;
}

export function Docs() {
  const [slug, setSlug] = useState<string | null>(() => slugFromHash());

  useEffect(() => {
    const onHash = () => setSlug(slugFromHash());
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  const recipe = slug ? getRecipe(slug) : undefined;
  const RecipeContent = slug ? RECIPES_CONTENT[slug] : undefined;

  return (
    <DocsLayout activeSlug={recipe?.slug}>
      {slug && recipe && RecipeContent ? (
        <RecipeContent />
      ) : (
        <DocsIndex />
      )}
    </DocsLayout>
  );
}
