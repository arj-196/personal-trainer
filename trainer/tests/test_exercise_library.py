from __future__ import annotations

from personal_trainer.exercise_library import ExerciseReference, resolve_reference


def _reference(name: str, aliases: tuple[str, ...] = ()) -> ExerciseReference:
    return ExerciseReference(
        slug=name.lower().replace(" ", "-"),
        name=name,
        aliases=aliases,
        summary="",
        setup="",
        cues=(),
        visual_note="",
        image_url="",
        source_title="",
        source_url="",
        author="",
        credit="",
        license="",
        license_url="",
    )


def test_resolve_reference_uses_exact_alias_match(monkeypatch) -> None:
    canonical = _reference("Canonical Curl")
    alias_map = {
        "canonical curl": canonical,
        "cannon curl": canonical,
    }

    monkeypatch.setattr(
        "personal_trainer.exercise_library._reference_map",
        lambda: alias_map,
    )
    monkeypatch.setattr(
        "personal_trainer.exercise_library._fuzzy_alias_entries",
        lambda: (),
    )

    match = resolve_reference("cannon curl")

    assert match is not None
    assert match.reference.name == "Canonical Curl"
    assert match.strategy == "exact"
    assert match.score == 1.0


def test_resolve_reference_accepts_high_confidence_fuzzy_match(monkeypatch) -> None:
    canonical = _reference("Ab wheel")

    monkeypatch.setattr(
        "personal_trainer.exercise_library._reference_map",
        lambda: {},
    )
    monkeypatch.setattr(
        "personal_trainer.exercise_library._fuzzy_alias_entries",
        lambda: (("ab wheel", canonical, "Ab wheel"),),
    )

    match = resolve_reference("Ab wheell")

    assert match is not None
    assert match.reference.name == "Ab wheel"
    assert match.strategy == "fuzzy"
    assert match.score >= 0.92


def test_resolve_reference_rejects_ambiguous_fuzzy_match(monkeypatch) -> None:
    first = _reference("Bench Press")
    second = _reference("Bench Presses")

    monkeypatch.setattr(
        "personal_trainer.exercise_library._reference_map",
        lambda: {},
    )
    monkeypatch.setattr(
        "personal_trainer.exercise_library._fuzzy_alias_entries",
        lambda: (
            ("bench press", first, "Bench Press"),
            ("bench presses", second, "Bench Presses"),
        ),
    )

    match = resolve_reference("bench presss")

    assert match is None


def test_resolve_reference_rejects_low_confidence_fuzzy_match(monkeypatch) -> None:
    canonical = _reference("Romanian Deadlift")

    monkeypatch.setattr(
        "personal_trainer.exercise_library._reference_map",
        lambda: {},
    )
    monkeypatch.setattr(
        "personal_trainer.exercise_library._fuzzy_alias_entries",
        lambda: (("romanian deadlift", canonical, "Romanian Deadlift"),),
    )

    match = resolve_reference("jump rope")

    assert match is None
