from personal_trainer.models import UserProfile
from personal_trainer.recipe_suggester import (
    infer_goal_bucket,
    normalize_ingredient,
    parse_pantry_items,
    suggest_recipes,
)


def test_parse_pantry_items_normalizes_and_deduplicates() -> None:
    pantry = parse_pantry_items("Chicken breast, rice\nBroccoli; broccoli")

    assert pantry == ["chicken", "rice", "broccoli"]


def test_goal_bucket_maps_common_goal_language() -> None:
    assert infer_goal_bucket("Lose fat while keeping muscle") == "fat loss"
    assert infer_goal_bucket("Build muscle") == "muscle gain"
    assert infer_goal_bucket("Get more protein each day") == "higher protein intake"


def test_suggest_recipes_ranks_goal_and_pantry_match_highest() -> None:
    profile = UserProfile(name="Jordan", goal="Build muscle")

    suggestions = suggest_recipes(
        profile,
        ["chicken", "rice", "broccoli", "garlic"],
        limit=3,
    )

    assert suggestions
    assert suggestions[0].title == "Chicken, Rice, and Broccoli Bowl"
    assert suggestions[0].fit_label == "strong fit"
    assert suggestions[0].missing_ingredients == []
    assert "chicken" in suggestions[0].pantry_ingredients_used


def test_suggest_recipes_can_override_goal() -> None:
    profile = UserProfile(name="Jordan", goal="Build muscle")

    suggestions = suggest_recipes(
        profile,
        ["eggs", "spinach", "tomato"],
        goal_override="Fat loss",
        limit=2,
    )

    assert suggestions[0].title == "Egg and Veggie Skillet"
    assert suggestions[0].goal_fit_reason.startswith("Strong goal match")


def test_suggest_recipes_returns_empty_when_pantry_is_empty() -> None:
    profile = UserProfile(name="Jordan", goal="Maintenance")

    assert suggest_recipes(profile, []) == []


def test_normalize_ingredient_handles_aliases() -> None:
    assert normalize_ingredient("Chicken Breast") == "chicken"
    assert normalize_ingredient("Canned Tomatoes") == "tomato"
