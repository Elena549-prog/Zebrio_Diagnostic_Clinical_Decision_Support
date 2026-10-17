/**
 * Recipe catalog — the metadata for the in-app docs recipes. Mirrors the
 * inspiration demo's `src/lib/recipes.ts` (RecipeMeta). Each recipe is a single
 * building block of Arbor, rendered as its own page under the in-app /docs
 * route, with a "See live feature →" link that deep-links into the demo.
 *
 * The content of each recipe lives in `recipes/<slug>.tsx`.
 */

export type RecipeMeta = {
  slug: string;
  number: number;
  title: string;
  navLabel: string;
  description: string;
  /** Deep link into the live demo (here a hash route into the workspace/home). */
  demoLink: string;
  demoLabel: string;
};

export const RECIPES: RecipeMeta[] = [
  {
    slug: "presentation",
    number: 1,
    title: "Presentation & intake — how a case starts",
    navLabel: "Presentation",
    description:
      "How a Case begins from a Presentation: the chief complaint, history, observations, and demographics that seed the whole tree.",
    demoLink: "#/tutorial",
    demoLabel: "Run the Guided tour — a scripted walk-through from presentation to plan",
  },
  {
    slug: "round",
    number: 2,
    title: "The reasoning round — gather, update, decide",
    navLabel: "The round",
    description:
      "What a Round is: the engine re-ranks the differential from the presentation + findings, branches hypotheses, and decides what to do next.",
    demoLink: "#/workspace",
    demoLabel: "Advance a round in the workspace and watch the rail",
  },
  {
    slug: "tree",
    number: 3,
    title: "The hypothesis tree — branching, kept, retraceable",
    navLabel: "Hypothesis tree",
    description:
      "Why the differential is a tree, not a flat list: a finding that splits a hypothesis branches it; ruled-out branches stay visible so the path is retraceable.",
    demoLink: "#/workspace",
    demoLabel: "Open the Tree view and click a node",
  },
  {
    slug: "horses-zebras",
    number: 4,
    title: "Horses vs zebras — base rates and the zebra flag",
    navLabel: "Horses vs zebras",
    description:
      "Common diagnoses are considered first; rare dangerous ones are flagged 🦓 and kept on the tree until ruled out — never silently dropped.",
    demoLink: "#/workspace",
    demoLabel: "Look for the 🦓 zebra tag on a lower-ranked node",
  },
  {
    slug: "tests",
    number: 5,
    title: "Tests as information gain — the HITL gate",
    navLabel: "Tests & HITL",
    description:
      "The engine proposes the test that best splits the remaining differential, then pauses for the clinician to order it and enter the result.",
    demoLink: "#/workspace",
    demoLabel: "At a gate, enter a result with “Add result & advance”",
  },
  {
    slug: "evidence",
    number: 6,
    title: "Evidence & experts — findings, citations, web sources",
    navLabel: "Evidence & experts",
    description:
      "Source-linked web evidence supports review of each hypothesis. Research and coding use replaceable team modules.",
    demoLink: "#/workspace",
    demoLabel: "Select a hypothesis to see its evidence and codes",
  },
  {
    slug: "working-diagnosis",
    number: 7,
    title: "Working diagnosis & reasoning trail",
    navLabel: "Working diagnosis",
    description:
      "Convergence: when one hypothesis dominates, the clinician sets the working diagnosis. The reasoning trail records every branch taken and pruned.",
    demoLink: "#/workspace",
    demoLabel: "When stable, click “Set working dx” in the detail panel",
  },
  {
    slug: "treatment",
    number: 8,
    title: "Treatment plan & surgical case-finding",
    navLabel: "Treatment plan",
    description:
      "After a working diagnosis, a second agent proposes a management plan and searches where in the world the relevant procedure has been performed.",
    demoLink: "#/workspace",
    demoLabel: "After diagnosis, click “Build treatment plan”",
  },
  {
    slug: "agent-team",
    number: 9,
    title: "The agent team — Claude roles and team modules",
    navLabel: "The agent team",
    description:
      "Claude reasoning, web research and validation, medical coding, and clinician-controlled workflow.",
    demoLink: "#/docs",
    demoLabel: "See the full team in this recipe",
  },
];

export function getRecipe(slug: string): RecipeMeta | undefined {
  return RECIPES.find((r) => r.slug === slug);
}

export function getRecipeByNumber(n: number): RecipeMeta | undefined {
  return RECIPES.find((r) => r.number === n);
}

export function getNextRecipe(slug: string): RecipeMeta | undefined {
  const recipe = getRecipe(slug);
  if (!recipe) return undefined;
  return getRecipeByNumber(recipe.number + 1);
}
