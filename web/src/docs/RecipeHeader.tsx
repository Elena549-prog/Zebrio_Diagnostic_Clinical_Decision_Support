/**
 * RecipeHeader — the top of every recipe page: a "Recipe N" badge, the title,
 * the lead description, and a "See live feature →" link that deep-links into
 * the demo. Mirrors the inspiration demo's RecipeHeader component.
 */

import type { RecipeMeta } from "./recipes.js";

interface Props {
  recipe: RecipeMeta;
}

export function RecipeHeader({ recipe }: Props) {
  return (
    <header className="recipe-header">
      <div className="recipe-badge">Recipe {recipe.number}</div>
      <h1 className="recipe-title">{recipe.title}</h1>
      <p className="recipe-lead muted">{recipe.description}</p>
      <a className="docs-demo-link" href={recipe.demoLink}>
        See live feature → {recipe.demoLabel}
      </a>
    </header>
  );
}
