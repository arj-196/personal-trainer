import Link from 'next/link';

import { parsePantryItems, recommendRecipes } from '@/lib/recipe-data';
import {
  listWorkspaces,
  readRecipeCatalog,
  readUserProfileSummary,
} from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

const GOAL_OPTIONS = [
  'Use profile goal',
  'Fat loss',
  'Muscle gain',
  'Maintenance',
  'Higher protein intake',
  'Faster post-workout recovery',
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; ingredients?: string; goal?: string }>;
}) {
  const params = await searchParams;
  const workspaces = await listWorkspaces();
  const selectedWorkspace =
    params.workspace && workspaces.includes(params.workspace)
      ? params.workspace
      : workspaces[0];
  const ingredientsInput = params.ingredients ?? '';
  const goalOverride = params.goal && params.goal !== 'Use profile goal' ? params.goal : '';
  const pantryItems = parsePantryItems(ingredientsInput);
  const [profile, catalog] = selectedWorkspace
    ? await Promise.all([
        readUserProfileSummary(selectedWorkspace),
        readRecipeCatalog(),
      ])
    : [null, await readRecipeCatalog()];
  const suggestions =
    pantryItems.length > 0 ? recommendRecipes(profile, catalog, pantryItems, goalOverride) : [];

  return (
    <main className="shell">
      <section className="hero">
        <span className="hero-eyebrow">Recipe Coach</span>
        <h1 className="hero-title">Cook from what you already have.</h1>
        <p className="hero-subtitle">
          Enter the ingredients in your kitchen and Personal Trainer will rank recipes against your pantry
          and your current goal.
        </p>
        <div className="hero-links">
          <Link className="chip-link" href={selectedWorkspace ? `/?workspace=${selectedWorkspace}` : '/'}>
            Workout View
          </Link>
          <Link className="chip-link active" href="/recipes">
            Recipes
          </Link>
          <Link className="chip-link" href="/library">
            Exercise Library
          </Link>
        </div>
      </section>

      {workspaces.length === 0 ? (
        <section className="empty-state">
          <h2 className="section-title">No workspaces yet</h2>
          <p>Create a workspace first so the recipe engine can read your current training goal.</p>
        </section>
      ) : (
        <section className="panel panel-spaced">
          <div className="section-head">
            <div>
              <h2 className="section-title">Recipe Suggestions</h2>
              <p className="section-copy">
                Active goal: <strong>{goalOverride || profile?.goal || 'Maintenance'}</strong>
              </p>
            </div>
          </div>

          <form className="recipe-form" action="/recipes">
            <label className="recipe-field">
              <span className="detail-label">Workspace</span>
              <select name="workspace" defaultValue={selectedWorkspace}>
                {workspaces.map((workspace) => (
                  <option key={workspace} value={workspace}>
                    {workspace}
                  </option>
                ))}
              </select>
            </label>

            <label className="recipe-field">
              <span className="detail-label">Goal Override</span>
              <select name="goal" defaultValue={goalOverride || 'Use profile goal'}>
                {GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="recipe-field recipe-field-wide">
              <span className="detail-label">Ingredients On Hand</span>
              <textarea
                name="ingredients"
                rows={4}
                defaultValue={ingredientsInput}
                placeholder="chicken, rice, broccoli, garlic, greek yogurt"
              />
            </label>

            <div className="hero-links">
              <button className="chip-link chip-button active" type="submit">
                Suggest Recipes
              </button>
              <Link className="chip-link" href={selectedWorkspace ? `/recipes?workspace=${selectedWorkspace}` : '/recipes'}>
                Clear
              </Link>
            </div>
          </form>

          {pantryItems.length > 0 ? (
            <div className="badge-row recipe-pantry-row">
              {pantryItems.map((item) => (
                <span key={item} className="badge">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {pantryItems.length === 0 ? (
            <div className="empty-state recipe-empty">
              <h3 className="section-title">Start with your pantry</h3>
              <p>
                Add a few ingredients and the trainer will return goal-aware recipes with missing ingredients,
                substitutions, and cooking steps.
              </p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="empty-state recipe-empty">
              <h3 className="section-title">No recipe matches yet</h3>
              <p>Try broader ingredient names like chicken, eggs, rice, beans, yogurt, spinach, or tofu.</p>
            </div>
          ) : (
            <div className="recipe-grid">
              {suggestions.map((recipe) => (
                <article key={recipe.title} className="recipe-card">
                  <div className="recipe-topline">
                    <span className="badge">{recipe.fitLabel}</span>
                    <span className="recipe-score">Score {recipe.score}</span>
                  </div>
                  <h3 className="library-title">{recipe.title}</h3>
                  <p className="library-copy">{recipe.summary}</p>
                  <div className="detail-list">
                    <section className="detail-section">
                      <span className="detail-label">Why It Fits</span>
                      <p className="library-copy">{recipe.goalFitReason}</p>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Time</span>
                      <p className="library-copy">
                        {recipe.estimatedPrepMinutes} min prep + {recipe.estimatedCookMinutes} min cook
                      </p>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Use From Pantry</span>
                      <div className="badge-row">
                        {recipe.pantryIngredientsUsed.map((item) => (
                          <span key={item} className="badge">
                            {item}
                          </span>
                        ))}
                      </div>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Missing Ingredients</span>
                      <div className="badge-row">
                        {recipe.missingIngredients.length > 0 ? (
                          recipe.missingIngredients.map((item) => (
                            <span key={item} className="badge badge-muted">
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="badge">none</span>
                        )}
                      </div>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Nutrition Summary</span>
                      <p className="library-copy">{recipe.nutritionSummary}</p>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Cooking Steps</span>
                      <ol className="recipe-steps">
                        {recipe.instructions.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Substitutions</span>
                      <ul className="cues">
                        {recipe.substitutions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    <section className="detail-section">
                      <span className="detail-label">Confidence Note</span>
                      <p className="library-copy">{recipe.confidenceNote}</p>
                    </section>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
