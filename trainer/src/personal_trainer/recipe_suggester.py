from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from personal_trainer.models import UserProfile

RECIPE_CATALOG_PATH = Path(__file__).resolve().parent / "assets" / "recipes" / "catalog.json"
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
INGREDIENT_ALIASES = {
    "chicken breast": "chicken",
    "chicken thighs": "chicken",
    "brown rice": "rice",
    "white rice": "rice",
    "frozen broccoli": "broccoli",
    "broccoli florets": "broccoli",
    "black beans": "beans",
    "kidney beans": "beans",
    "chopped tomatoes": "tomato",
    "canned tomatoes": "tomato",
    "baby spinach": "spinach",
    "plain greek yogurt": "greek yogurt",
    "whey protein": "protein powder",
}


@dataclass(frozen=True, slots=True)
class RecipeCatalogEntry:
    slug: str
    title: str
    summary: str
    meal_type: str
    goal_tags: list[str]
    ingredients_required: list[str]
    ingredients_optional: list[str]
    substitutions: list[str]
    estimated_prep_minutes: int
    estimated_cook_minutes: int
    instructions: list[str]
    nutrition_summary: str
    confidence_note: str


@dataclass(frozen=True, slots=True)
class RecipeSuggestion:
    title: str
    summary: str
    goal_fit_reason: str
    fit_label: str
    pantry_ingredients_used: list[str]
    missing_ingredients: list[str]
    optional_ingredients: list[str]
    estimated_prep_minutes: int
    estimated_cook_minutes: int
    instructions: list[str]
    substitutions: list[str]
    nutrition_summary: str
    confidence_note: str
    score: float


def load_recipe_catalog() -> list[RecipeCatalogEntry]:
    items = json.loads(RECIPE_CATALOG_PATH.read_text(encoding="utf-8"))
    return [RecipeCatalogEntry(**item) for item in items]


def parse_pantry_items(raw: str) -> list[str]:
    candidates = re.split(r"[\n,;/]+", raw)
    seen: set[str] = set()
    pantry: list[str] = []

    for candidate in candidates:
        normalized = normalize_ingredient(candidate)
        if normalized and normalized not in seen:
            pantry.append(normalized)
            seen.add(normalized)

    return pantry


def suggest_recipes(
    profile: UserProfile,
    pantry_items: list[str],
    *,
    goal_override: str | None = None,
    limit: int = 5,
) -> list[RecipeSuggestion]:
    pantry = {normalize_ingredient(item) for item in pantry_items if normalize_ingredient(item)}
    if not pantry:
        return []

    goal = goal_override.strip() if goal_override else profile.goal
    goal_bucket = infer_goal_bucket(goal)
    suggestions: list[RecipeSuggestion] = []

    for recipe in load_recipe_catalog():
        required = [normalize_ingredient(item) for item in recipe.ingredients_required]
        optional = [normalize_ingredient(item) for item in recipe.ingredients_optional]
        used = [item for item in required if item in pantry]
        missing = [item for item in required if item not in pantry]
        optional_used = [item for item in optional if item in pantry]
        if len(used) == 0:
            continue

        coverage = len(used) / len(required)
        goal_score = _goal_score(goal_bucket, recipe.goal_tags)
        missing_penalty = len(missing) * 0.75
        optional_bonus = min(len(optional_used), 2) * 0.15
        score = goal_score + (coverage * 3.0) + optional_bonus - missing_penalty

        suggestions.append(
            RecipeSuggestion(
                title=recipe.title,
                summary=recipe.summary,
                goal_fit_reason=_goal_fit_reason(goal_bucket, recipe.goal_tags, coverage, missing),
                fit_label=_fit_label(goal_score, coverage, missing),
                pantry_ingredients_used=used + [item for item in optional_used if item not in used],
                missing_ingredients=missing,
                optional_ingredients=[item for item in optional if item not in optional_used],
                estimated_prep_minutes=recipe.estimated_prep_minutes,
                estimated_cook_minutes=recipe.estimated_cook_minutes,
                instructions=recipe.instructions,
                substitutions=recipe.substitutions,
                nutrition_summary=recipe.nutrition_summary,
                confidence_note=recipe.confidence_note,
                score=round(score, 2),
            )
        )

    suggestions.sort(key=lambda item: (-item.score, len(item.missing_ingredients), item.title))
    return suggestions[:limit]


def infer_goal_bucket(goal: str) -> str:
    normalized = normalize_ingredient(goal)
    if any(token in normalized for token in ("fat loss", "lose fat", "cut", "lean")):
        return "fat loss"
    if any(token in normalized for token in ("muscle", "bulk", "gain", "hypertrophy")):
        return "muscle gain"
    if any(token in normalized for token in ("recovery", "post workout", "postworkout")):
        return "faster post-workout recovery"
    if any(token in normalized for token in ("protein",)):
        return "higher protein intake"
    return "maintenance"


def normalize_ingredient(value: str) -> str:
    lowered = " ".join(TOKEN_PATTERN.findall(value.lower()))
    lowered = re.sub(r"\b\d+\b", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    if not lowered:
        return ""
    canonical = INGREDIENT_ALIASES.get(lowered, lowered)
    if canonical.endswith("es") and len(canonical) > 4:
        singular = canonical[:-2]
        if singular in {"tomato", "potato"}:
            return singular
    if canonical.endswith("s") and len(canonical) > 3 and not canonical.endswith("ss"):
        singular = canonical[:-1]
        if singular not in {"oat", "bean"}:
            return singular
    return canonical


def _goal_score(goal_bucket: str, goal_tags: list[str]) -> float:
    normalized_tags = {normalize_ingredient(tag) for tag in goal_tags}
    if normalize_ingredient(goal_bucket) in normalized_tags:
        return 3.0
    if goal_bucket == "higher protein intake" and "muscle gain" in goal_tags:
        return 2.5
    if goal_bucket == "maintenance":
        return 2.0
    return 1.0


def _goal_fit_reason(
    goal_bucket: str, goal_tags: list[str], coverage: float, missing: list[str]
) -> str:
    coverage_pct = int(round(coverage * 100))
    if normalize_ingredient(goal_bucket) in {
        normalize_ingredient(tag) for tag in goal_tags
    }:
        if not missing:
            return f"Strong goal match with full pantry coverage and {coverage_pct}% of required ingredients already available."
        return f"Strong goal match that still uses {coverage_pct}% of the required ingredients you already have."
    if not missing:
        return f"Good pantry match with full ingredient coverage, even though the goal fit is more general."
    return f"Useful fallback with {coverage_pct}% pantry coverage and a broader fit for {goal_bucket}."


def _fit_label(goal_score: float, coverage: float, missing: list[str]) -> str:
    if goal_score >= 3.0 and coverage >= 0.8 and not missing:
        return "strong fit"
    if goal_score >= 2.0 and coverage >= 0.5:
        return "decent fit"
    return "fallback"
