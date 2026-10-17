/**
 * RecipeFooter — the bottom of every recipe page: a "Next: Recipe N+1 — …" link
 * for sequential reading, or a "Back to all recipes" link after the last.
 */

import { getNextRecipe } from "./recipes.js";

interface Props {
  slug: string;
}

export function RecipeFooter({ slug }: Props) {
  const next = getNextRecipe(slug);
  return (
    <footer className="recipe-footer">
      {next ? (
        <a className="recipe-next" href={`#/docs/${next.slug}`}>
          Next: Recipe {next.number} — {next.title} →
        </a>
      ) : (
        <a className="recipe-next" href="#/docs">
          ↑ Back to all recipes
        </a>
      )}
    </footer>
  );
}
